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
import { blackMarketInspectionPlayerBody } from '@shared/lib/blackMarketMessages';
import {
  BLACK_MARKET_MAX_INSPECTIONS,
  BLACK_MARKET_REFRESH_MS,
  blackMarketUnit,
  classifyBlackMarketReveal,
  computeBlackMarketAnchorValue,
  createBlackMarketPricing,
  evaluateBlackMarketHaggle,
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
  type BlackMarketInteractionResult,
  type BlackMarketNegotiationMood,
  type BlackMarketNpcId,
  type BlackMarketOverview,
  type BlackMarketReveal,
  type BlackMarketSessionView,
} from '@shared/types/blackMarket';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_ORDER,
  QUALITY_VALUES,
} from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import {
  buildBlackMarketMask,
  buildBlackMarketSafeClues,
  inferQuestionClueKind,
} from './BlackMarketClueService';
import { blackMarketConversationService } from './BlackMarketConversationService';
import { BLACK_MARKET_NPCS, getBlackMarketNpc } from './BlackMarketNpcConfig';
import { blackMarketSessionRepository } from './BlackMarketSessionRepository';
import type {
  BlackMarketInteractCommand,
  BlackMarketInternalSession,
  BlackMarketSafeClue,
} from './types';

const PURCHASE_SOURCE = 'black_market_purchase';
const SESSION_MESSAGE_LIMIT = 24;

type Actor = { userId: string; cultivatorId: string };

export class BlackMarketServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function currentCycle(now = Date.now()): number {
  return Math.floor(now / BLACK_MARKET_REFRESH_MS);
}

function cycleEnd(cycle: number): number {
  return (cycle + 1) * BLACK_MARKET_REFRESH_MS;
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET?.trim();
  if (!value)
    throw new Error('BETTER_AUTH_SECRET is required for black market');
  return value;
}

function derive(parts: readonly (string | number)[]): string {
  return createHmac('sha256', secret())
    .update(`black-market-v1:${parts.join(':')}`)
    .digest('hex');
}

function sessionIdentity(input: {
  cultivatorId: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
  cycle: number;
}) {
  const seed = derive([
    input.cultivatorId,
    input.nodeId,
    input.npcId,
    input.cycle,
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
  cycle: number;
}): string {
  return `${input.nodeId}:${input.cycle}:${input.npcId}`;
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
  const qualities = QUALITY_VALUES.filter(
    (quality) => QUALITY_ORDER[quality] >= QUALITY_ORDER['真品'],
  );
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

function publicSession(
  session: BlackMarketInternalSession,
): BlackMarketSessionView {
  const revealed = new Set(session.revealedClueIds);
  const negotiationMood: BlackMarketNegotiationMood =
    session.phase === 'deal_ready' || session.phase === 'completed'
      ? 'agreed'
      : session.pricing.patience <= 0
        ? 'closed'
        : session.pricing.patience === 1
          ? 'impatient'
          : session.pricing.patience === 2
            ? 'guarded'
            : 'calm';
  return {
    id: session.id,
    nodeId: session.nodeId,
    npcId: session.npcId,
    cycle: session.cycle,
    phase: session.cycle === currentCycle() ? session.phase : 'expired',
    listing: {
      id: session.listingId,
      disguisedName: session.disguisedName,
      description: session.disguisedDescription,
    },
    initialPrice: session.pricing.initialPrice,
    currentPrice: session.pricing.currentPrice,
    canInspect:
      session.cycle === currentCycle() &&
      session.phase === 'talking' &&
      session.inspectTurnsUsed < BLACK_MARKET_MAX_INSPECTIONS,
    canHaggle:
      session.cycle === currentCycle() &&
      session.phase === 'talking' &&
      session.pricing.patience > 0,
    negotiationMood,
    revealedClues: session.clues
      .filter((clue) => revealed.has(clue.id))
      .map(({ id, kind, text }) => ({ id, kind, text })),
    messages: session.messages,
    version: session.version,
    expiresAt: session.expiresAt,
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
  if (session.cycle !== currentCycle() || session.expiresAt <= Date.now()) {
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
}

async function completedPurchase(
  cultivatorId: string,
  nodeId: string,
  npcId: BlackMarketNpcId,
  cycle: number,
) {
  return findPlayerMutationRequest(
    cultivatorId,
    PURCHASE_SOURCE,
    purchaseRequestId({ nodeId, npcId, cycle }),
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
  cycle: number;
}): Promise<BlackMarketInternalSession> {
  const identity = sessionIdentity({
    cultivatorId: input.actor.cultivatorId,
    nodeId: input.nodeId,
    npcId: input.npcId,
    cycle: input.cycle,
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
  const profile = getRegionProfile(input.nodeId);
  const regionFactor =
    profile.priceModifier.min +
    blackMarketUnit(identity.seed, 'region-price') *
      (profile.priceModifier.max - profile.priceModifier.min);
  const anchorValue = computeBlackMarketAnchorValue({
    quality: hiddenItem.rank,
    materialType: hiddenItem.type,
    regionFactor,
  });
  const pricing = createBlackMarketPricing({
    seed: identity.seed,
    npcId: input.npcId,
    anchorValue,
  });
  const mask = buildBlackMarketMask(hiddenItem, identity.seed);
  const npc = getBlackMarketNpc(input.npcId);
  const now = Date.now();
  const session: BlackMarketInternalSession = {
    id: identity.sessionId,
    userId: input.actor.userId,
    cultivatorId: input.actor.cultivatorId,
    nodeId: input.nodeId,
    npcId: input.npcId,
    cycle: input.cycle,
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
    revealedClueIds: [],
    clues: buildBlackMarketSafeClues({
      item: hiddenItem,
      npcId: input.npcId,
      seed: identity.seed,
      regionTags: getNodeRegionTags(input.nodeId),
    }),
    messages: [
      {
        id: `${identity.sessionId}:opening`,
        role: 'npc',
        body: npc.opening,
        createdAt: now,
      },
    ],
    version: 1,
    expiresAt: cycleEnd(input.cycle),
  };

  const existingPurchase = await completedPurchase(
    input.actor.cultivatorId,
    input.nodeId,
    input.npcId,
    input.cycle,
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
  const cycle = currentCycle();
  const identity = sessionIdentity({
    cultivatorId: input.actor.cultivatorId,
    nodeId: input.nodeId,
    npcId: input.npcId,
    cycle,
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
          cycle,
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
      const created = await generateSession({ ...input, cycle });
      await blackMarketSessionRepository.save(created);
      return created;
    },
  );
}

function selectClue(
  session: BlackMarketInternalSession,
  command: BlackMarketInteractCommand,
): BlackMarketSafeClue {
  const revealed = new Set(session.revealedClueIds);
  const available = session.clues.filter((clue) => !revealed.has(clue.id));
  const requestedKind =
    command.action === 'inspect'
      ? command.inspectionKind
      : inferQuestionClueKind(command.message ?? '');
  const selected = requestedKind
    ? available.find((clue) => clue.kind === requestedKind)
    : available[
        Math.floor(
          blackMarketUnit(
            session.seed,
            `free-question:${session.inspectTurnsUsed}:${command.message ?? ''}`,
          ) * available.length,
        )
      ];
  if (!selected) {
    throw new BlackMarketServiceError(
      409,
      requestedKind
        ? '这个方向已经查过，换个角度试试'
        : '已经没有新的线索可问了',
    );
  }
  return selected;
}

function negotiationReply(input: {
  preface: string;
  outcome: ReturnType<typeof evaluateBlackMarketHaggle>['outcome'];
  price: number;
}): string {
  const suffix =
    input.outcome === 'accepted'
      ? `行，就按你说的，${input.price}灵石。`
      : input.outcome === 'countered' || input.outcome === 'conceded'
        ? `最多让到${input.price}灵石。`
        : input.outcome === 'locked'
          ? `价就定在${input.price}灵石，再谈便不卖了。`
          : `这个价不成，仍是${input.price}灵石。`;
  return `${input.preface.trim()} ${suffix}`.trim();
}

export async function getBlackMarketOverview(input: {
  actor: Actor;
  nodeId: string;
}): Promise<BlackMarketOverview> {
  const access = await assertAccess(input.actor, input.nodeId);
  const cycle = currentCycle();
  const statuses = await Promise.all(
    BLACK_MARKET_NPCS.map(async (npc) => {
      const identity = sessionIdentity({
        cultivatorId: input.actor.cultivatorId,
        nodeId: input.nodeId,
        npcId: npc.id,
        cycle,
      });
      const [purchase, session] = await Promise.all([
        completedPurchase(
          input.actor.cultivatorId,
          input.nodeId,
          npc.id,
          cycle,
        ),
        blackMarketSessionRepository.find(identity.sessionId),
      ]);
      return purchase ? 'completed' : session ? 'in_progress' : 'available';
    }),
  );
  const nodeTags = getNodeRegionTags(input.nodeId);
  return {
    nodeId: input.nodeId,
    cycle,
    nextRefresh: cycleEnd(cycle),
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
}): Promise<BlackMarketSessionView> {
  await assertAccess(input.actor, input.nodeId);
  return publicSession(await getOrGenerateInternal(input));
}

export async function interactWithBlackMarket(input: {
  actor: Actor;
  nodeId: string;
  sessionId: string;
  command: BlackMarketInteractCommand;
  abortSignal?: AbortSignal;
}): Promise<BlackMarketInteractionResult> {
  await assertAccess(input.actor, input.nodeId);
  const snapshot = await blackMarketSessionRepository.find(input.sessionId);
  if (!snapshot || snapshot.nodeId !== input.nodeId) {
    throw new BlackMarketServiceError(404, '没有找到这场黑市交易');
  }
  assertCurrentSession(snapshot, input.actor);
  assertConversationOpen(snapshot);
  if (snapshot.version !== input.command.version) {
    throw new BlackMarketServiceError(409, '摊前情形已经变化，请刷新后再试');
  }
  const npc = getBlackMarketNpc(snapshot.npcId);
  const knownClues = snapshot.clues
    .filter((clue) => snapshot.revealedClueIds.includes(clue.id))
    .map((clue) => ({ id: clue.id, text: clue.text }));

  let selectedClue: BlackMarketSafeClue | undefined;
  if (
    input.command.action === 'inspect' ||
    input.command.action === 'question'
  ) {
    if (snapshot.inspectTurnsUsed >= BLACK_MARKET_MAX_INSPECTIONS) {
      throw new BlackMarketServiceError(409, '三次查验机会已经用尽');
    }
    selectedClue = selectClue(snapshot, input.command);
  } else if (snapshot.pricing.patience <= 0) {
    throw new BlackMarketServiceError(409, '摊主已经不愿继续议价');
  }

  const judged = await blackMarketConversationService.judge({
    action: input.command.action,
    message: input.command.message,
    offeredPrice: input.command.offeredPrice,
    npc,
    allowedClue: selectedClue,
    knownClues,
    currentPrice: snapshot.pricing.currentPrice,
    abortSignal: input.abortSignal,
  });
  if (judged.degraded && input.command.action === 'haggle') {
    return {
      session: publicSession(snapshot),
      degraded: true,
      notice: '摊主没有听清这轮出价，本次不计入砍价次数。',
    };
  }

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
      assertConversationOpen(session);
      if (session.version !== input.command.version) {
        throw new BlackMarketServiceError(
          409,
          '摊前情形已经变化，请刷新后再试',
        );
      }
      const now = Date.now();
      const playerBody =
        input.command.message?.trim() ||
        (selectedClue
          ? blackMarketInspectionPlayerBody(selectedClue.kind)
          : input.command.action === 'haggle' && input.command.offeredPrice
            ? `我出${input.command.offeredPrice.toLocaleString()}灵石。`
            : '再次出价');
      let outcome: BlackMarketInteractionResult['outcome'];
      let npcReply = judged.judgment.reply;

      if (
        input.command.action === 'inspect' ||
        input.command.action === 'question'
      ) {
        if (!selectedClue)
          throw new BlackMarketServiceError(409, '没有可用线索');
        const storedClue = session.clues.find(
          (clue) => clue.id === selectedClue.id,
        );
        if (!storedClue) throw new BlackMarketServiceError(409, '线索已经失效');
        storedClue.text = judged.judgment.reply;
        session.revealedClueIds.push(selectedClue.id);
        session.inspectTurnsUsed += 1;
      } else {
        const offeredPrice = input.command.offeredPrice;
        if (
          !Number.isSafeInteger(offeredPrice) ||
          !offeredPrice ||
          offeredPrice < 1
        ) {
          throw new BlackMarketServiceError(400, '请给出有效的灵石报价');
        }
        const knownIds = new Set(session.revealedClueIds);
        const validEvidenceCount = new Set(
          judged.judgment.referencedClueIds.filter((id) => knownIds.has(id)),
        ).size;
        const decision = evaluateBlackMarketHaggle({
          seed: session.seed,
          npcId: session.npcId,
          currentPrice: session.pricing.currentPrice,
          floorPrice: session.pricing.floorPrice,
          offeredPrice,
          patience: session.pricing.patience,
          strategy: judged.judgment.strategy,
          argumentQuality: judged.judgment.argumentQuality,
          validEvidenceCount,
          randomRoll: blackMarketUnit(
            session.seed,
            `haggle:${session.haggleTurnsUsed}:${offeredPrice}`,
          ),
        });
        session.haggleTurnsUsed += 1;
        session.pricing.currentPrice = decision.nextPrice;
        session.pricing.patience = decision.nextPatience;
        session.phase =
          decision.outcome === 'accepted' ? 'deal_ready' : 'talking';
        outcome = decision.outcome;
        npcReply = negotiationReply({
          preface: judged.judgment.reply,
          outcome: decision.outcome,
          price: decision.nextPrice,
        });
      }

      appendMessages(session, [
        {
          id: `${session.id}:${session.version}:player`,
          role: 'player',
          body: playerBody,
          createdAt: now,
        },
        {
          id: `${session.id}:${session.version}:npc`,
          role: 'npc',
          body: npcReply,
          createdAt: now + 1,
        },
      ]);
      session.version += 1;
      await blackMarketSessionRepository.save(session);
      return {
        session: publicSession(session),
        outcome,
        degraded: judged.degraded,
      };
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
    session.pricing.anchorValue,
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
    initialPrice: session.pricing.initialPrice,
    paidPrice: price,
    anchorValue: session.pricing.anchorValue,
    valueRatio: assessment.valueRatio,
    rating: assessment.rating,
    epilogue: npc.epilogue,
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
  if (snapshot.cycle !== currentCycle()) {
    throw new BlackMarketServiceError(410, '这批黑市货物已经收摊');
  }
  const requestId = purchaseRequestId(snapshot);
  const fingerprint = `${snapshot.nodeId}:${snapshot.cycle}:${snapshot.npcId}:${snapshot.listingId}`;

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
      if (session.cycle !== currentCycle()) {
        throw new BlackMarketServiceError(410, '这批黑市货物已经收摊');
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
      // Leaving only closes the local conversation view. The same stall keeps
      // its clues, price and agreed-deal state until this market cycle ends.
      session.version += 1;
      await blackMarketSessionRepository.save(session);
      return publicSession(session);
    },
  );
}
