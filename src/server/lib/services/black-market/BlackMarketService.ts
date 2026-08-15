import type { DbTransaction } from '@server/lib/drizzle/db';
import { cultivators, materials } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { findPlayerMutationRequest } from '@server/lib/repositories/playerStateRepository';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import {
  materialLibraryEntryToMaterial,
  sampleMaterialLibraryEntryByPreferences,
} from '@server/lib/services/MaterialLibraryService';
import { readCultivatorRealm } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { mapMaterialRow } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import {
  applyBlackMarketBeliefPatch,
  describeBlackMarketClaimMode,
} from '@shared/lib/blackMarketBelief';
import {
  applyBlackMarketPriceDecision,
  assessOffer,
} from '@shared/lib/blackMarketNegotiation';
import {
  applyBlackMarketBeliefPressure,
  computeBlackMarketTrueValue,
  createBlackMarketPricing,
} from '@shared/lib/blackMarketPricing';
import {
  BLACK_MARKET_ENTRY_COST,
  BLACK_MARKET_MAX_INSPECTIONS,
  BLACK_MARKET_MAX_TURNS,
  BLACK_MARKET_QUALITIES,
  blackMarketDayEnd,
  blackMarketDayKey,
  blackMarketEntryCost,
  blackMarketTurnsRemaining,
  blackMarketUnit,
  classifyBlackMarketReveal,
} from '@shared/lib/blackMarketRules';
import {
  BLACK_MARKET_QUALITY_WEIGHTS,
  getMarketConfigByNodeId,
  getNodeRegionTags,
  getRegionProfile,
  isMarketNodeEnabled,
  validateLayerAccess,
} from '@shared/lib/game/marketConfig';
import {
  type BlackMarketInteractCommand,
  type BlackMarketInteractionResult,
  type BlackMarketNegotiationMood,
  type BlackMarketNpcId,
  type BlackMarketOpenResult,
  type BlackMarketOverview,
  type BlackMarketReveal,
  type BlackMarketSessionView,
} from '@shared/types/blackMarket';
import { MATERIAL_TYPE_VALUES, QUALITY_ORDER } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';
import { createHmac, randomUUID } from 'node:crypto';
import {
  blackMarketConversationService,
  fallbackTurnReply,
} from './BlackMarketConversationService';
import {
  grantBlackMarketEntry,
  listBlackMarketEntryGrants,
} from './BlackMarketEntryService';
import { buildBlackMarketMask } from './BlackMarketMaskService';
import { BLACK_MARKET_NPCS, getBlackMarketNpc } from './BlackMarketNpcConfig';
import { blackMarketObservationService } from './BlackMarketObservationService';
import { blackMarketPerceptionService } from './BlackMarketPerceptionService';
import { blackMarketSessionRepository } from './BlackMarketSessionRepository';
import type {
  BlackMarketInternalSession,
  BlackMarketPreparedTurn,
  BlackMarketTurnContext,
  BlackMarketTurnProposal,
} from './types';

const PURCHASE_SOURCE = 'black_market_purchase';
const SESSION_MESSAGE_LIMIT = 24;
const PENDING_TURN_STALE_MS = 30_000;
type Actor = { userId: string; cultivatorId: string };

export class BlackMarketServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET?.trim();
  if (!value)
    throw new Error('BETTER_AUTH_SECRET is required for black market');
  return value;
}

function derive(parts: readonly (string | number)[]): string {
  return createHmac('sha256', secret())
    .update(`black-market-v2:${parts.join(':')}`)
    .digest('hex');
}

function sessionIdentity(input: {
  cultivatorId: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
  dayKey: string;
}) {
  const seed = derive([
    input.cultivatorId,
    input.nodeId,
    input.npcId,
    input.dayKey,
  ]);
  return {
    seed,
    sessionId: derive(['session', seed]).slice(0, 40),
    listingId: derive(['listing', seed]).slice(0, 40),
  };
}

function purchaseRequestId(input: {
  nodeId: string;
  npcId: BlackMarketNpcId;
  dayKey: string;
}): string {
  return `${input.dayKey}:${input.nodeId}:${input.npcId}`;
}

function weightedPick<T extends string>(
  entries: readonly { value: T; weight: number }[],
  unit: number,
): T {
  const total = entries.reduce(
    (sum, entry) => sum + Math.max(0, entry.weight),
    0,
  );
  if (total <= 0) return entries[0].value;
  let roll = unit * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

function rotatePreferred<T>(values: readonly T[], preferred: T): T[] {
  return [preferred, ...values.filter((value) => value !== preferred)];
}

function selectMaterialPreferences(seed: string, nodeId: string) {
  const profile = getRegionProfile(nodeId);
  const materialType = weightedPick(
    MATERIAL_TYPE_VALUES.map((value) => ({
      value,
      weight: profile.typeWeights[value] ?? 0.25,
    })),
    blackMarketUnit(seed, 'material-type'),
  );
  const qualities = [...BLACK_MARKET_QUALITIES];
  const quality = weightedPick(
    qualities.map((value) => ({
      value,
      weight: BLACK_MARKET_QUALITY_WEIGHTS[value] ?? 1,
    })),
    blackMarketUnit(seed, 'quality'),
  );
  const materialTypes = [...MATERIAL_TYPE_VALUES].sort(
    (left, right) =>
      (profile.typeWeights[right] ?? 0) - (profile.typeWeights[left] ?? 0),
  );
  return {
    materialTypes: rotatePreferred(materialTypes, materialType),
    qualities: rotatePreferred(
      [...qualities].sort(
        (left, right) =>
          Math.abs(QUALITY_ORDER[left] - QUALITY_ORDER[quality]) -
          Math.abs(QUALITY_ORDER[right] - QUALITY_ORDER[quality]),
      ),
      quality,
    ),
  };
}
function appendMessages(
  session: BlackMarketInternalSession,
  messages: BlackMarketInternalSession['messages'],
): void {
  session.messages = [...session.messages, ...messages].slice(
    -SESSION_MESSAGE_LIMIT,
  );
}

function negotiationMood(
  session: BlackMarketInternalSession,
): BlackMarketNegotiationMood {
  if (session.phase === 'deal_ready' || session.phase === 'completed') {
    return 'agreed';
  }
  if (session.pricing.patience <= 0) return 'closed';
  if (session.pricing.patience === 1) return 'impatient';
  if (session.pricing.patience === 2) return 'guarded';
  return 'calm';
}

function publicSession(
  session: BlackMarketInternalSession,
): BlackMarketSessionView {
  const revealed = new Set(session.revealedObservationIds);
  const isCurrentDay = session.dayKey === blackMarketDayKey();
  const turnsRemaining = blackMarketTurnsRemaining(session.turnsUsed);
  const pendingTurnActive = Boolean(
    session.pendingTurn &&
      Date.now() - session.pendingTurn.startedAt < PENDING_TURN_STALE_MS,
  );
  const canInteract =
    isCurrentDay &&
    session.phase === 'talking' &&
    turnsRemaining > 0 &&
    !pendingTurnActive;
  return {
    id: session.id,
    nodeId: session.nodeId,
    npcId: session.npcId,
    dayKey: session.dayKey,
    phase: isCurrentDay ? session.phase : 'expired',
    listing: {
      id: session.listingId,
      disguisedName: session.disguisedName,
      description: session.disguisedDescription,
    },
    initialPrice: session.pricing.initialPrice,
    currentPrice: session.pricing.currentPrice,
    canInspect:
      canInteract &&
      session.inspectTurnsUsed < BLACK_MARKET_MAX_INSPECTIONS,
    inspectionRemaining: Math.max(
      0,
      BLACK_MARKET_MAX_INSPECTIONS - session.inspectTurnsUsed,
    ),
    canHaggle:
      canInteract && session.pricing.patience > 0,
    canInteract,
    turnsRemaining,
    negotiationMood: negotiationMood(session),
    observations: session.observations
      .filter(
        (observation) =>
          observation.source === 'surface' || revealed.has(observation.id),
      )
      .map(({ id, topic, source, text, reliability, revealedAtTurn }) => ({
        id,
        topic,
        source,
        text,
        reliability,
        revealedAtTurn,
      })),
    sellerClaims: session.memory.claims.map(({ id, topic, text, turn }) => ({
      id,
      topic,
      text,
      turn,
    })),
    messages: session.messages,
    version: session.version,
    reveal: session.reveal,
  };
}

function assertCurrentSession(
  session: BlackMarketInternalSession,
  actor: Actor,
): void {
  if (
    session.userId !== actor.userId ||
    session.cultivatorId !== actor.cultivatorId
  ) {
    throw new BlackMarketServiceError(404, '没有找到这场黑市交易');
  }
  if (session.dayKey !== blackMarketDayKey() || session.expiresAt <= Date.now()) {
    throw new BlackMarketServiceError(410, '这批黑市货物已经收摊');
  }
  if (session.phase === 'completed') {
    throw new BlackMarketServiceError(409, '这件货物已经成交');
  }
}

function assertConversationOpen(session: BlackMarketInternalSession): void {
  if (session.phase === 'deal_ready') {
    throw new BlackMarketServiceError(
      409,
      '摊主已经点头，这个价只等你成交或转身离开',
    );
  }
  if (blackMarketTurnsRemaining(session.turnsUsed) <= 0) {
    throw new BlackMarketServiceError(
      409,
      '今日能说的已经说尽，可按当前价成交或离开',
    );
  }
  if (session.pendingTurn) {
    throw new BlackMarketServiceError(409, '摊主正在斟酌上一句话');
  }
}

async function completedPurchase(
  cultivatorId: string,
  nodeId: string,
  npcId: BlackMarketNpcId,
  dayKey: string,
) {
  return findPlayerMutationRequest(
    cultivatorId,
    PURCHASE_SOURCE,
    purchaseRequestId({ nodeId, npcId, dayKey }),
  );
}

async function assertAccess(actor: Actor, nodeId: string) {
  if (!isMarketNodeEnabled(nodeId)) {
    throw new BlackMarketServiceError(404, '此地没有开放坊市');
  }
  const config = getMarketConfigByNodeId(nodeId);
  const { realm } = await readCultivatorRealm(actor.cultivatorId);
  const access = validateLayerAccess(realm, 'black', config);
  if (!access.allowed) {
    throw new BlackMarketServiceError(403, access.reason || '无法进入黑市');
  }
  return access;
}

async function generateSession(input: {
  actor: Actor;
  nodeId: string;
  npcId: BlackMarketNpcId;
  dayKey: string;
}): Promise<BlackMarketInternalSession> {
  const identity = sessionIdentity({
    cultivatorId: input.actor.cultivatorId,
    nodeId: input.nodeId,
    npcId: input.npcId,
    dayKey: input.dayKey,
  });
  const preferences = selectMaterialPreferences(identity.seed, input.nodeId);
  const entry = await sampleMaterialLibraryEntryByPreferences({
    ...preferences,
    seed: `${identity.seed}:library`,
  });
  if (!entry) {
    throw new BlackMarketServiceError(503, '黑市今日无货，请稍后再来');
  }
  const hiddenItem = materialLibraryEntryToMaterial(entry);
  const trueValue = computeBlackMarketTrueValue({
    quality: hiddenItem.rank,
    materialType: hiddenItem.type,
  });
  const pricing = createBlackMarketPricing({
    seed: identity.seed,
    npcId: input.npcId,
    trueValue,
  });
  const mask = buildBlackMarketMask(hiddenItem, identity.seed);
  const npc = getBlackMarketNpc(input.npcId);
  let observations: BlackMarketInternalSession['observations'];
  try {
    observations = await blackMarketObservationService.build({
      item: hiddenItem,
      itemLibraryItemId: entry.itemId,
      disguisedName: mask.disguisedName,
      disguisedDescription: mask.disguisedDescription,
      regionTags: getNodeRegionTags(input.nodeId),
    });
  } catch (error) {
    console.warn('[black-market] observation generation failed', { error });
    throw new BlackMarketServiceError(
      503,
      '摊主正在重新遮掩货物，请稍后再来。',
    );
  }
  const perceived = await blackMarketPerceptionService.build({
    npc,
    pricing,
    observations,
  });
  const now = Date.now();
  const session: BlackMarketInternalSession = {
    id: identity.sessionId,
    userId: input.actor.userId,
    cultivatorId: input.actor.cultivatorId,
    nodeId: input.nodeId,
    npcId: input.npcId,
    dayKey: input.dayKey,
    listingId: identity.listingId,
    phase: 'talking',
    seed: identity.seed,
    itemLibraryItemId: entry.itemId,
    hiddenItem,
    disguisedName: mask.disguisedName,
    disguisedDescription: mask.disguisedDescription,
    pricing,
    inspectTurnsUsed: 0,
    haggleTurnsUsed: 0,
    revealedObservationIds: [],
    observations,
    belief: perceived.belief,
    initialBeliefSummary: perceived.belief.beliefSummary,
    memory: {
      claims: [],
      playerOffers: [],
      citedObservationIds: [],
      promises: [],
      activeBluffs: [],
      turnSummary: '双方刚在摊前照面。',
    },
    messages: [
      {
        id: `${identity.sessionId}:opening`,
        role: 'npc',
        body: perceived.opening,
        createdAt: now,
        turn: 0,
      },
    ],
    turnsUsed: 0,
    maxTurns: BLACK_MARKET_MAX_TURNS,
    version: 1,
    expiresAt: blackMarketDayEnd(),
  };

  const existingPurchase = await completedPurchase(
    input.actor.cultivatorId,
    input.nodeId,
    input.npcId,
    input.dayKey,
  );
  if (existingPurchase) {
    const result = existingPurchase.result as { reveal?: BlackMarketReveal };
    session.phase = 'completed';
    session.reveal = result.reveal;
    if (result.reveal) session.pricing.currentPrice = result.reveal.paidPrice;
  }
  return session;
}

async function getOrGenerateInternal(input: {
  actor: Actor;
  nodeId: string;
  npcId: BlackMarketNpcId;
}): Promise<BlackMarketInternalSession> {
  const dayKey = blackMarketDayKey();
  const identity = sessionIdentity({
    cultivatorId: input.actor.cultivatorId,
    nodeId: input.nodeId,
    npcId: input.npcId,
    dayKey,
  });
  return withRedisLock(
    {
      key: redisLockKeys.blackMarketSession(identity.sessionId),
      context: 'black-market-session-create',
      timeoutMs: 15_000,
      retries: 1,
    },
    async () => {
      const existing = await blackMarketSessionRepository.find(
        identity.sessionId,
      );
      if (existing) {
        const purchase = await completedPurchase(
          input.actor.cultivatorId,
          input.nodeId,
          input.npcId,
          dayKey,
        );
        if (purchase) {
          const result = purchase.result as { reveal?: BlackMarketReveal };
          existing.phase = 'completed';
          existing.reveal = result.reveal;
          if (result.reveal) {
            existing.pricing.currentPrice = result.reveal.paidPrice;
          }
          await blackMarketSessionRepository.save(existing);
          return existing;
        }
        if (existing.phase === 'abandoned') {
          existing.phase = 'talking';
          existing.version += 1;
          await blackMarketSessionRepository.save(existing);
        }
        return existing;
      }
      const created = await generateSession({ ...input, dayKey });
      await blackMarketSessionRepository.save(created);
      return created;
    },
  );
}

function buildTurnContext(
  session: BlackMarketInternalSession,
  npc: ReturnType<typeof getBlackMarketNpc>,
  command: BlackMarketInteractCommand,
): BlackMarketTurnContext {
  const revealed = new Set(session.revealedObservationIds);
  const regionTags = getNodeRegionTags(session.nodeId);
  const knownObservations = session.observations
    .filter(
      (observation) =>
        observation.source === 'surface' || revealed.has(observation.id),
    )
    .map((observation) => ({
      id: observation.id,
      topic: observation.topic,
      text: observation.text,
      reliability: observation.reliability,
    }));
  const availableObservations = session.observations
    .filter(
      (observation) =>
        observation.source === 'inspection' && !revealed.has(observation.id),
    )
    .map((observation) => ({
      id: observation.id,
      topic: observation.topic,
      safeFact: observation.safeFact,
    }));

  return {
    scene: {
      title: '暗巷黑市',
      description: `${regionTags[1] ?? '坊市'}灯火照不到的窄巷里，三道身影各守着一件不肯明说来历的货。`,
    },
    npc: {
      name: npc.name,
      voice: npc.voice,
      identity: npc.identity,
      mood: negotiationMood(session),
      flexibilityLevel: session.pricing.flexibilityLevel,
    },
    listing: {
      disguisedName: session.disguisedName,
      disguisedDescription: session.disguisedDescription,
    },
    currentPrice: session.pricing.currentPrice,
    offerAssessment:
      command.offeredPrice != null
        ? assessOffer({
            currentPrice: session.pricing.currentPrice,
            floorPrice: session.pricing.currentFloorPrice,
            offeredPrice: command.offeredPrice,
          })
        : undefined,
    canInspect:
      session.phase === 'talking' &&
      session.inspectTurnsUsed < BLACK_MARKET_MAX_INSPECTIONS,
    canHaggle: session.phase === 'talking' && session.pricing.patience > 0,
    turnsRemaining: blackMarketTurnsRemaining(session.turnsUsed),
    dealReady: session.phase === 'deal_ready',
    belief: session.belief,
    memory: session.memory,
    knownObservations,
    availableObservations,
    conversation: session.messages,
    playerMessage: command.message?.trim() ?? '',
    offeredPrice: command.offeredPrice,
  };
}

function sanitizeProposal(
  session: BlackMarketInternalSession,
  proposal: BlackMarketTurnProposal,
  hasOffer: boolean,
): BlackMarketTurnProposal {
  const knownIds = new Set(
    session.observations
      .filter(
        (item) =>
          item.source === 'surface' ||
          session.revealedObservationIds.includes(item.id),
      )
      .map((item) => item.id),
  );
  const availableIds = new Set(
    session.observations
      .filter(
        (item) =>
          item.source === 'inspection' &&
          !session.revealedObservationIds.includes(item.id),
      )
      .map((item) => item.id),
  );
  const canReveal = session.inspectTurnsUsed < BLACK_MARKET_MAX_INSPECTIONS;
  const referencedObservationIds = proposal.referencedObservationIds.filter(
    (id) => knownIds.has(id),
  );
  let claimPlan = proposal.claimPlan;
  let downgradedEvasionSummary: string | undefined;
  if (
    claimPlan?.mode === 'bluff' &&
    session.belief.bluffsUsed >= session.belief.bluffBudget
  ) {
    const evasionSummary: Record<BlackMarketNpcId, string> = {
      'smiling-keeper': '含笑避谈来路，只让买家从眼前货物自行判断。',
      'silent-elder': '拒绝继续解释，只认可眼前已经看见的痕迹。',
      'urgent-cultivator': '回避货物来源，催促买家自行决定是否接手。',
    };
    downgradedEvasionSummary = evasionSummary[session.npcId];
    claimPlan = {
      topic: claimPlan.topic,
      mode: 'evasion',
      summary: downgradedEvasionSummary,
    };
  }
  return {
    ...proposal,
    referencedObservationIds,
    revealObservationId:
      canReveal &&
      proposal.revealObservationId &&
      availableIds.has(proposal.revealObservationId)
        ? proposal.revealObservationId
        : undefined,
    beliefPressure:
      proposal.beliefPressure < 0 &&
      !(
        proposal.reasoning.evidenceStrength === 'credible' &&
        referencedObservationIds.length > 0
      )
        ? 0
        : proposal.beliefPressure,
    claimPlan,
    negotiation:
      hasOffer && !proposal.negotiation
        ? { decision: 'counter', concession: 0.25, patienceDelta: -1 }
        : proposal.negotiation,
    memoryPatch: {
      promises: proposal.memoryPatch.promises.slice(0, 2),
      activeBluffs:
        claimPlan?.mode === 'bluff'
          ? proposal.memoryPatch.activeBluffs.slice(0, 2)
          : [],
      turnSummary:
        downgradedEvasionSummary ??
        proposal.memoryPatch.turnSummary.slice(0, 160),
    },
  };
}

function applyReveals(
  session: BlackMarketInternalSession,
  proposal: BlackMarketTurnProposal,
): void {
  const id = proposal.revealObservationId;
  if (!id || session.revealedObservationIds.includes(id)) return;
  const observation = session.observations.find(
    (candidate) => candidate.id === id && candidate.source === 'inspection',
  );
  if (!observation) return;
  observation.revealedAtTurn = session.version;
  session.revealedObservationIds.push(id);
  session.inspectTurnsUsed += 1;
}

function playerBody(command: BlackMarketInteractCommand): string {
  const text = command.message?.trim();
  if (text && command.offeredPrice != null) {
    return `${text}（报价：${command.offeredPrice.toLocaleString()}灵石）`;
  }
  if (text) return text;
  if (command.offeredPrice != null) {
    return `我出${command.offeredPrice.toLocaleString()}灵石。`;
  }
  return '（沉默）';
}

export async function getBlackMarketOverview(input: {
  actor: Actor;
  nodeId: string;
}): Promise<BlackMarketOverview> {
  const access = await assertAccess(input.actor, input.nodeId);
  const now = Date.now();
  const dayKey = blackMarketDayKey(now);
  const grants = await listBlackMarketEntryGrants({
    cultivatorId: input.actor.cultivatorId,
    dayKey,
  });
  const grantedNpcIds = new Set(
    grants
      .filter((grant) => grant.nodeId === input.nodeId)
      .map((grant) => grant.npcId),
  );
  const statuses = await Promise.all(
    BLACK_MARKET_NPCS.map(async (npc) => {
      const identity = sessionIdentity({
        cultivatorId: input.actor.cultivatorId,
        nodeId: input.nodeId,
        npcId: npc.id,
        dayKey,
      });
      const [purchase, session] = await Promise.all([
        completedPurchase(
          input.actor.cultivatorId,
          input.nodeId,
          npc.id,
          dayKey,
        ),
        blackMarketSessionRepository.find(identity.sessionId),
      ]);
      return purchase
        ? ('completed' as const)
        : session
          ? ('in_progress' as const)
          : grantedNpcIds.has(npc.id)
            ? ('granted' as const)
            : ('available' as const);
    }),
  );
  const nodeTags = getNodeRegionTags(input.nodeId);
  return {
    nodeId: input.nodeId,
    dayKey,
    resetsAt: blackMarketDayEnd(now),
    entryPolicy: {
      usedEntries: grants.length,
      freeEntryAvailable: grants.length === 0,
      nextEntryCost: blackMarketEntryCost(grants.length),
      paidEntryCost: BLACK_MARKET_ENTRY_COST,
    },
    access,
    scene: {
      title: '暗巷黑市',
      description: `${nodeTags[1] ?? '坊市'}灯火照不到的窄巷里，三道身影各守着一件不肯明说来历的货。`,
    },
    npcs: BLACK_MARKET_NPCS.map((npc, index) => ({
      id: npc.id,
      sigil: npc.sigil,
      name: npc.name,
      identity: npc.identity,
      responsibility: npc.responsibility,
      status: statuses[index] ?? 'available',
    })),
  };
}

export async function openBlackMarketSession(input: {
  actor: Actor;
  nodeId: string;
  npcId: BlackMarketNpcId;
}) {
  await assertAccess(input.actor, input.nodeId);
  const dayKey = blackMarketDayKey();
  const committed = await grantBlackMarketEntry({
    userId: input.actor.userId,
    cultivatorId: input.actor.cultivatorId,
    dayKey,
    nodeId: input.nodeId,
    npcId: input.npcId,
  });
  const entry = {
    cost: committed.result.cost,
    free: committed.result.free,
    replayed: Boolean(committed.state.replayed),
  };
  let result: BlackMarketOpenResult;
  try {
    result = {
      status: 'ready',
      session: publicSession(await getOrGenerateInternal(input)),
      entry,
    };
  } catch (error) {
    console.warn('[black-market] granted entry session generation failed', {
      cultivatorId: input.actor.cultivatorId,
      dayKey,
      nodeId: input.nodeId,
      npcId: input.npcId,
      error,
    });
    result = {
      status: 'retryable',
      entry,
      message: '入场凭证已记下，可重新靠近，不会重复扣费。',
    };
  }
  return { result, state: committed.state };
}

export async function prepareBlackMarketInteraction(input: {
  actor: Actor;
  nodeId: string;
  sessionId: string;
  command: BlackMarketInteractCommand;
  abortSignal?: AbortSignal;
}): Promise<BlackMarketPreparedTurn> {
  await assertAccess(input.actor, input.nodeId);
  const pendingToken = randomUUID();
  const snapshot = await withRedisLock(
    {
      key: redisLockKeys.blackMarketSession(input.sessionId),
      context: 'black-market-turn-reserve',
      timeoutMs: 10_000,
      retries: 0,
    },
    async () => {
      const session = await blackMarketSessionRepository.find(input.sessionId);
      if (!session || session.nodeId !== input.nodeId) {
        throw new BlackMarketServiceError(404, '没有找到这场黑市交易');
      }
      if (
        session.pendingTurn &&
        Date.now() - session.pendingTurn.startedAt >= PENDING_TURN_STALE_MS
      ) {
        session.pendingTurn = undefined;
      }
      assertCurrentSession(session, input.actor);
      assertConversationOpen(session);
      if (session.version !== input.command.version) {
        throw new BlackMarketServiceError(
          409,
          '摊前情形已经变化，请刷新后再试',
        );
      }
      if (
        input.command.offeredPrice != null &&
        input.command.offeredPrice < session.pricing.currentPrice &&
        session.pricing.patience <= 0
      ) {
        throw new BlackMarketServiceError(409, '摊主已经不愿继续议价');
      }
      session.pendingTurn = {
        token: pendingToken,
        version: session.version,
        startedAt: Date.now(),
      };
      session.turnsUsed += 1;
      await blackMarketSessionRepository.save(session);
      return session;
    },
  );

  const snapshotNpc = getBlackMarketNpc(snapshot.npcId);
  const snapshotContext = buildTurnContext(
    snapshot,
    snapshotNpc,
    input.command,
  );
  let judged: Awaited<
    ReturnType<typeof blackMarketConversationService.proposeTurn>
  >;
  try {
    judged = await blackMarketConversationService.proposeTurn({
      context: snapshotContext,
    });
  } catch (error) {
    await clearPendingBlackMarketTurn(input.sessionId, pendingToken);
    throw error;
  }
  const proposed = judged.proposal;

  return withRedisLock(
    {
      key: redisLockKeys.blackMarketSession(input.sessionId),
      context: 'black-market-interact',
      timeoutMs: 15_000,
      retries: 0,
    },
    async () => {
      const session = await blackMarketSessionRepository.find(input.sessionId);
      if (!session) throw new BlackMarketServiceError(404, '黑市会话已经失效');
      assertCurrentSession(session, input.actor);
      if (session.version !== input.command.version) {
        throw new BlackMarketServiceError(
          409,
          '摊前情形已经变化，请刷新后再试',
        );
      }
      if (
        session.pendingTurn?.token !== pendingToken ||
        session.pendingTurn.version !== input.command.version
      ) {
        throw new BlackMarketServiceError(409, '这轮交谈已经失效');
      }

      const npc = getBlackMarketNpc(session.npcId);
      const proposal = sanitizeProposal(
        session,
        proposed,
        input.command.offeredPrice != null,
      );
      if (
        input.command.offeredPrice != null &&
        input.command.offeredPrice >= session.pricing.currentPrice
      ) {
        proposal.negotiation = {
          decision: 'accept',
          concession: 0,
          patienceDelta: -1,
        };
      }

      const now = Date.now();
      const body = playerBody(input.command);
      let outcome: BlackMarketInteractionResult['outcome'];
      let negotiationOutcome:
        ReturnType<typeof applyBlackMarketPriceDecision> | undefined;

      applyReveals(session, proposal);
      const hasCredibleEvidence =
        proposal.reasoning.evidenceStrength === 'credible' &&
        proposal.referencedObservationIds.length > 0;
      session.pricing.currentFloorPrice = applyBlackMarketBeliefPressure({
        initialPrice: session.pricing.initialPrice,
        currentPrice: session.pricing.currentPrice,
        floorMinPrice: session.pricing.floorMinPrice,
        floorMaxPrice: session.pricing.floorMaxPrice,
        currentFloorPrice: session.pricing.currentFloorPrice,
        pressure: proposal.beliefPressure,
        hasCredibleEvidence,
      });
      const relevantObservationIds = new Set(
        proposal.revealObservationId
          ? [
              ...proposal.referencedObservationIds,
              proposal.revealObservationId,
            ]
          : proposal.referencedObservationIds,
      );
      const beliefSummaryFallback =
        proposal.beliefPressure < 0
          ? '货主重新审视玩家引用的客观痕迹，对原先估量的把握有所下降。'
          : proposal.beliefPressure > 0
            ? '货主听过玩家的说法后，反而更坚持原先的估量。'
            : undefined;
      const beliefUpdate = applyBlackMarketBeliefPatch({
        belief: session.belief,
        patch: {
          ...proposal.beliefPatch,
          beliefSummary:
            proposal.beliefPatch.beliefSummary ?? beliefSummaryFallback,
        },
        relevantObservationIds,
        negativeChangeAllowed: hasCredibleEvidence,
        summaryChangeAllowed:
          proposal.beliefPressure !== 0 ||
          (proposal.reasoning.conflictsWithBelief && hasCredibleEvidence),
      });
      session.belief.confidence = beliefUpdate.belief.confidence;
      session.belief.beliefSummary = beliefUpdate.belief.beliefSummary;
      session.belief.clueInterpretations =
        beliefUpdate.belief.clueInterpretations;

      if (input.command.offeredPrice != null) {
        const offeredPrice = input.command.offeredPrice;
        if (!Number.isSafeInteger(offeredPrice) || offeredPrice < 1) {
          throw new BlackMarketServiceError(400, '请给出有效的灵石报价');
        }

        const negotiation = proposal.negotiation ?? {
          decision: 'counter' as const,
          concession: 0.25,
          patienceDelta: -1 as const,
        };
        const decision = applyBlackMarketPriceDecision({
          currentPrice: session.pricing.currentPrice,
          floorPrice: session.pricing.currentFloorPrice,
          offeredPrice,
          patience: session.pricing.patience,
          decision: negotiation.decision,
          concession: negotiation.concession,
          patienceDelta: negotiation.patienceDelta,
        });

        session.haggleTurnsUsed += 1;
        session.pricing.currentPrice = decision.nextPrice;
        session.pricing.patience = decision.nextPatience;
        session.phase =
          decision.outcome === 'accepted' ? 'deal_ready' : 'talking';
        outcome = decision.outcome;
        negotiationOutcome = decision;
        session.memory.playerOffers.push(offeredPrice);
      } else if (proposal.intent === 'buy') {
        session.phase = 'deal_ready';
        outcome = 'accepted';
      } else if (proposal.intent === 'leave') {
        session.phase = 'abandoned';
      }

      // Stage B may see the updated belief and server-approved negotiation state,
      // but not memory that has not yet been spoken in this turn.
      const messageId = `${session.id}:${session.version}:npc`;
      const replyContext = buildTurnContext(session, npc, input.command);
      const fallbackBody = fallbackTurnReply({
        context: replyContext,
        proposal,
        negotiationOutcome,
      });

      session.memory.citedObservationIds = Array.from(
        new Set([
          ...session.memory.citedObservationIds,
          ...proposal.referencedObservationIds,
        ]),
      ).slice(-12);
      session.memory.promises = [
        ...session.memory.promises,
        ...proposal.memoryPatch.promises,
      ].slice(-8);
      session.memory.activeBluffs = [
        ...session.memory.activeBluffs,
        ...proposal.memoryPatch.activeBluffs,
      ].slice(-6);
      session.memory.turnSummary = proposal.memoryPatch.turnSummary;

      if (proposal.claimPlan) {
        session.memory.claims.push({
          id: `${messageId}:claim`,
          topic: proposal.claimPlan.topic,
          text: fallbackBody,
          mode: proposal.claimPlan.mode,
          turn: session.version,
        });
        session.memory.claims = session.memory.claims.slice(-12);
        if (proposal.claimPlan.mode === 'bluff') {
          session.belief.bluffsUsed = Math.min(
            session.belief.bluffBudget,
            session.belief.bluffsUsed + 1,
          );
        }
      }

      appendMessages(session, [
        {
          id: `${session.id}:${session.version}:player`,
          role: 'player',
          body,
          createdAt: now,
          turn: session.version,
        },
        {
          id: messageId,
          role: 'npc',
          body: fallbackBody,
          createdAt: now + 1,
          turn: session.version,
          gesture: proposal.gesture,
        },
      ]);
      session.pendingTurn = undefined;
      session.version += 1;
      await blackMarketSessionRepository.save(session);
      return {
        result: {
          session: publicSession(session),
          outcome,
          degraded: judged.degraded,
        },
        sessionId: session.id,
        messageId,
        gesture: proposal.gesture,
        fallbackBody,
        replyContext,
        proposal,
        negotiationOutcome,
      };
    },
  );
}

async function clearPendingBlackMarketTurn(
  sessionId: string,
  pendingToken: string,
): Promise<void> {
  await withRedisLock(
    {
      key: redisLockKeys.blackMarketSession(sessionId),
      context: 'black-market-turn-release',
      timeoutMs: 10_000,
      retries: 0,
    },
    async () => {
      const session = await blackMarketSessionRepository.find(sessionId);
      if (!session || session.pendingTurn?.token !== pendingToken) return;
      session.pendingTurn = undefined;
      await blackMarketSessionRepository.save(session);
    },
  );
}

export async function completeBlackMarketReply(input: {
  sessionId: string;
  messageId: string;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) return;
  await withRedisLock(
    {
      key: redisLockKeys.blackMarketSession(input.sessionId),
      context: 'black-market-reply-complete',
      timeoutMs: 10_000,
      retries: 0,
    },
    async () => {
      const session = await blackMarketSessionRepository.find(input.sessionId);
      if (!session) return;
      const message = session.messages.find(
        (item) => item.id === input.messageId,
      );
      if (!message || message.role !== 'npc') return;
      message.body = body;
      const claim = session.memory.claims.find(
        (item) => item.id === `${input.messageId}:claim`,
      );
      if (claim) claim.text = body;
      await blackMarketSessionRepository.save(session);
    },
  );
}

async function preparePurchase(
  session: BlackMarketInternalSession,
  tx: DbTransaction,
): Promise<{
  reveal: BlackMarketReveal;
  inventoryItem: ReturnType<typeof mapMaterialRow>;
  remainingSpiritStones: number;
}> {
  const price = session.pricing.currentPrice;
  const [updatedCultivator] = await tx
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${price}` })
    .where(
      and(
        eq(cultivators.id, session.cultivatorId),
        sql`${cultivators.spirit_stones} >= ${price}`,
      ),
    )
    .returning({ spiritStones: cultivators.spirit_stones });
  if (!updatedCultivator) {
    throw new BlackMarketServiceError(400, '囊中羞涩，灵石不足');
  }
  const stored = await addMaterialStackToInventory(
    session.cultivatorId,
    { ...session.hiddenItem, quantity: 1, details: {} },
    tx,
  );
  const [row] = await tx
    .select()
    .from(materials)
    .where(
      and(
        eq(materials.id, stored.id),
        eq(materials.cultivatorId, session.cultivatorId),
      ),
    )
    .limit(1);
  if (!row) throw new BlackMarketServiceError(500, '黑市货物入袋失败');
  const inventoryItem = mapMaterialRow(row);
  const assessment = classifyBlackMarketReveal(
    price,
    session.pricing.trueValue,
  );
  const npc = getBlackMarketNpc(session.npcId);
  const reveal: BlackMarketReveal = {
    material: {
      id: stored.id,
      name: session.hiddenItem.name,
      type: session.hiddenItem.type,
      rank: session.hiddenItem.rank,
      element: session.hiddenItem.element,
      description: session.hiddenItem.description,
      quantity: 1,
    },
    ownerAskPrice: session.pricing.initialPrice,
    paidPrice: price,
    trueValue: session.pricing.trueValue,
    valueRatio: assessment.valueRatio,
    rating: assessment.rating,
    epilogue: npc.epilogue,
    ownerBeliefSummary: session.initialBeliefSummary,
    ownerFinalBeliefSummary:
      session.belief.beliefSummary === session.initialBeliefSummary
        ? undefined
        : session.belief.beliefSummary,
    clueReview: session.observations
      .filter(
        (observation) =>
          observation.source === 'surface' ||
          session.revealedObservationIds.includes(observation.id),
      )
      .slice(0, 5)
      .map((observation) => ({
        observation: observation.text,
        ownerInterpretation:
          session.belief.clueInterpretations.find(
            (item) => item.observationId === observation.id,
          )?.interpretation ?? '货主没有说透自己的判断。',
        truth: observation.truthExplanation,
      })),
    claimReview: session.memory.claims.slice(-3).map((claim) => ({
      claim: claim.text,
      verdict: describeBlackMarketClaimMode(claim.mode),
    })),
  };
  return {
    reveal,
    inventoryItem,
    remainingSpiritStones: updatedCultivator.spiritStones,
  };
}

export async function commitBlackMarketPurchase(input: {
  actor: Actor;
  nodeId: string;
  sessionId: string;
  version: number;
  expectedPrice: number;
}) {
  await assertAccess(input.actor, input.nodeId);
  const snapshot = await blackMarketSessionRepository.find(input.sessionId);
  if (!snapshot || snapshot.nodeId !== input.nodeId) {
    throw new BlackMarketServiceError(404, '没有找到这场黑市交易');
  }
  if (snapshot.dayKey !== blackMarketDayKey()) {
    throw new BlackMarketServiceError(410, '这批黑市货物已经收摊');
  }
  const requestId = purchaseRequestId(snapshot);
  const fingerprint = `${snapshot.dayKey}:${snapshot.nodeId}:${snapshot.npcId}:${snapshot.listingId}`;

  return withRedisLock(
    {
      keys: [
        redisLockKeys.blackMarketSession(snapshot.id),
        redisLockKeys.cultivatorMutation(input.actor.cultivatorId),
      ],
      context: 'black-market-purchase',
      timeoutMs: 20_000,
      retries: 0,
    },
    async (lease) => {
      const session =
        (await blackMarketSessionRepository.find(input.sessionId)) ?? snapshot;
      if (
        session.userId !== input.actor.userId ||
        session.cultivatorId !== input.actor.cultivatorId
      ) {
        throw new BlackMarketServiceError(404, '没有找到这场黑市交易');
      }
      if (session.dayKey !== blackMarketDayKey()) {
        throw new BlackMarketServiceError(410, '这批黑市货物已经收摊');
      }
      if (session.pendingTurn) {
        throw new BlackMarketServiceError(409, '摊主还在斟酌上一句话');
      }
      if (
        session.phase !== 'completed' &&
        (session.version !== input.version ||
          session.pricing.currentPrice !== input.expectedPrice)
      ) {
        throw new BlackMarketServiceError(
          409,
          '摊主的报价已经变化，请按最新价格重新确认',
        );
      }
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: input.actor.userId,
        cultivatorId: input.actor.cultivatorId,
        source: PURCHASE_SOURCE,
        idempotency: { key: requestId, fingerprint },
        command: async (tx) => {
          const purchased = await preparePurchase(session, tx);
          const resourceChanges: ResourceChangeDescriptor[] = [
            {
              resourceTopic: 'player.currency',
              eventType: 'currency.black-market.spent',
              operation: 'merge',
              payload: { spiritStones: purchased.remainingSpiritStones },
            },
            {
              resourceTopic: 'inventory.materials',
              eventType: 'inventory.black-market.purchased',
              operation: 'upsert-items',
              payload: { idKey: 'id', items: [purchased.inventoryItem] },
            },
          ];
          return {
            result: { reveal: purchased.reveal },
            resourceChanges,
          };
        },
      });
      const result = committed.result as { reveal: BlackMarketReveal };
      session.phase = 'completed';
      session.reveal = result.reveal;
      session.pricing.currentPrice = result.reveal.paidPrice;
      session.version += 1;
      appendMessages(session, [
        {
          id: `${session.id}:completed`,
          role: 'system',
          body: `交易落定，伪装褪去：${result.reveal.material.name}。`,
          createdAt: Date.now(),
        },
      ]);
      try {
        await blackMarketSessionRepository.save(session);
      } catch (error) {
        console.error(
          '[black-market] purchase committed but session sync failed',
          {
            sessionId: session.id,
            error,
          },
        );
      }
      return committed;
    },
  );
}

export async function leaveBlackMarketSession(input: {
  actor: Actor;
  nodeId: string;
  sessionId: string;
  version: number;
}): Promise<BlackMarketSessionView> {
  return withRedisLock(
    {
      key: redisLockKeys.blackMarketSession(input.sessionId),
      context: 'black-market-leave',
      timeoutMs: 10_000,
      retries: 0,
    },
    async () => {
      const session = await blackMarketSessionRepository.find(input.sessionId);
      if (!session || session.nodeId !== input.nodeId) {
        throw new BlackMarketServiceError(404, '没有找到这场黑市交易');
      }
      assertCurrentSession(session, input.actor);
      if (session.version !== input.version) {
        throw new BlackMarketServiceError(
          409,
          '摊前情形已经变化，请刷新后再试',
        );
      }
      if (session.pendingTurn) {
        throw new BlackMarketServiceError(409, '摊主还在斟酌上一句话');
      }
      if (session.phase !== 'deal_ready') {
        session.phase = 'abandoned';
      }
      session.version += 1;
      await blackMarketSessionRepository.save(session);
      return publicSession(session);
    },
  );
}
