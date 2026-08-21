import { db, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { cultivators, sectMemberships } from '@server/lib/drizzle/schema';
import {
  appendStoryEvent,
  createStoryProgressIfMissing,
  findStoryEventByDedupeKey,
  findStoryProgress,
  updateStoryProgress,
} from '@server/lib/repositories/storyRepository';
import {
  applyFlagPatch,
  applyTrustDelta,
  buildExpectedScene,
  buildStoryContinuation,
  buildStorySnapshot,
  createInitialStoryProgress,
  isFoundationOrAbove,
  QINGXI_HERB_SLOPE_NODE_ID,
  resolveStoryChoice,
  routeAllowsExpectedScene,
  VOLUME_ONE_SECT_CAST,
  type StoryActorContext,
  type StoryProgressState,
} from '@server/lib/story/volume1Definition';
import {
  buildVolumeOneSurface,
  isVolumeOneInteractionAvailable,
  resolveVolumeOneSurfaceInteraction,
} from '@server/lib/story/surfaces/volume1Surfaces';
import { isDomainEventType, type DomainEventEnvelope } from '@shared/contracts/domainEvents';
import type {
  MainStoryMutationResult,
  MainStoryRuntimeEventType,
  MainStorySceneQueryResult,
  MainStorySnapshot,
  StorySurfaceContext,
  StorySurfaceInteractionResult,
  StorySurfaceKey,
  StorySurfaceResult,
} from '@shared/types/story';
import { and, eq } from 'drizzle-orm';

class StoryStateError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

type LoadedStory = {
  actor: StoryActorContext | null;
  progressId: string | null;
  progress: StoryProgressState | null;
  lockedReason?: string;
};

async function loadActor(
  cultivatorId: string,
  q: DbExecutor,
): Promise<StoryActorContext | null> {
  const cultivator = await q.query.cultivators.findFirst({
    columns: { id: true, name: true, realm: true },
    where: eq(cultivators.id, cultivatorId),
  });
  if (!cultivator) return null;

  const membership = await q.query.sectMemberships.findFirst({
    columns: { sectId: true },
    where: and(
      eq(sectMemberships.cultivatorId, cultivatorId),
      eq(sectMemberships.status, 'active'),
    ),
  });
  if (!membership) return null;

  return {
    cultivatorId,
    playerName: cultivator.name,
    realm: cultivator.realm,
    sectId: membership.sectId,
  };
}

async function loadOrInitializeStory(
  cultivatorId: string,
  q: DbExecutor,
): Promise<LoadedStory> {
  const actor = await loadActor(cultivatorId, q);
  if (!actor) {
    return {
      actor: null,
      progressId: null,
      progress: null,
      lockedReason: '加入宗门后，第一卷才会启封。',
    };
  }
  if (!VOLUME_ONE_SECT_CAST[actor.sectId]) {
    return {
      actor,
      progressId: null,
      progress: null,
      lockedReason: `当前宗门“${actor.sectId}”尚未配置第一卷人物镜像。`,
    };
  }

  let persisted = await findStoryProgress(cultivatorId, q);
  if (!persisted) {
    const initial = createInitialStoryProgress();
    await createStoryProgressIfMissing(
      {
        cultivatorId,
        currentNodeId: initial.currentNodeId,
        currentStep: initial.currentStep,
        flags: initial.flags,
        npcTrust: initial.npcTrust,
      },
      q,
    );
    persisted = await findStoryProgress(cultivatorId, q);
  }
  if (!persisted) throw new StoryStateError('主线进度初始化失败', 409);
  return {
    actor,
    progressId: persisted.id,
    progress: persisted.state,
  };
}

function globalPendingScene(
  progress: StoryProgressState,
  actor: StoryActorContext,
) {
  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  if (key !== '01-07:found-page' && key !== '01-10:voice') return null;
  return buildExpectedScene(progress, actor);
}

export async function getMainStorySnapshot(
  cultivatorId: string,
): Promise<MainStorySnapshot> {
  return db.transaction(async (tx) => {
    const loaded = await loadOrInitializeStory(cultivatorId, tx);
    return buildStorySnapshot(loaded.progress, loaded.lockedReason);
  });
}

export async function getMainStoryScene(args: {
  cultivatorId: string;
  pathname: string;
}): Promise<MainStorySceneQueryResult> {
  return db.transaction(async (tx) => {
    const loaded = await loadOrInitializeStory(args.cultivatorId, tx);
    const story = buildStorySnapshot(loaded.progress, loaded.lockedReason);
    if (!loaded.progress || !loaded.actor || loaded.progress.status === 'completed') {
      return { story, scene: null };
    }
    if (!routeAllowsExpectedScene(loaded.progress, args.pathname)) {
      return { story, scene: null };
    }
    return {
      story,
      scene: buildExpectedScene(loaded.progress, loaded.actor),
    };
  });
}

function buildNextState(
  progress: StoryProgressState,
  transition: ReturnType<typeof resolveStoryChoice>,
): StoryProgressState {
  return {
    ...progress,
    status: transition.status ?? progress.status,
    currentNodeId: transition.nodeId,
    currentStep: transition.step,
    flags: applyFlagPatch(progress.flags, transition.setFlags),
    npcTrust: applyTrustDelta(progress.npcTrust, transition.trustDelta),
    completedAt: transition.completed ? new Date() : progress.completedAt,
  };
}


const CLUE_BY_RUNTIME_EVENT: Partial<Record<MainStoryRuntimeEventType, string>> = {
  v1_root_investigated: 'root_missing',
  v1_spring_moon_observed: 'foreign_moon',
  v1_auction_future_listing_opened: 'future_listing',
  v1_auction_future_listing_resolved: 'future_listing',
  v1_black_market_fragment_resolved: 'black_fragment',
  v1_lamp_mismatch_verified: 'eighteenth_lamp',
  dungeon_blank_page_collected: 'blank_page',
  v1_gate_ledger_resolved: 'unknown_gate_record',
  v1_voice_heard: 'first_voice',
};

async function emitStoryDomainEvents(args: {
  cultivatorId: string;
  before: StoryProgressState;
  after: StoryProgressState;
  eventType?: MainStoryRuntimeEventType;
  choiceId?: string;
  tx: DbTransaction;
}): Promise<void> {
  const { before, after, tx } = args;
  if (before.currentNodeId !== after.currentNodeId) {
    await createDomainEvent(
      {
        type: 'story.node.completed',
        aggregate: { type: 'cultivator', id: args.cultivatorId },
        data: {
          cultivatorId: args.cultivatorId,
          storyId: 'main.v1',
          storyVersion: 1,
          nodeId: before.currentNodeId,
          nextNodeId: after.currentNodeId,
          choiceId: args.choiceId,
        },
        deduplicationKey: `story-node:${args.cultivatorId}:${before.currentNodeId}`,
      },
      tx,
    );
  }

  const clueId = args.eventType ? CLUE_BY_RUNTIME_EVENT[args.eventType] : undefined;
  if (clueId) {
    await createDomainEvent(
      {
        type: 'story.clue.discovered',
        aggregate: { type: 'cultivator', id: args.cultivatorId },
        data: {
          cultivatorId: args.cultivatorId,
          storyId: 'main.v1',
          storyVersion: 1,
          nodeId: before.currentNodeId,
          clueId,
        },
        deduplicationKey: `story-clue:${args.cultivatorId}:${clueId}`,
      },
      tx,
    );
  }

  if (before.status !== 'completed' && after.status === 'completed') {
    await createDomainEvent(
      {
        type: 'story.volume.completed',
        aggregate: { type: 'cultivator', id: args.cultivatorId },
        data: {
          cultivatorId: args.cultivatorId,
          storyId: 'main.v1',
          storyVersion: 1,
          volume: 1,
        },
        deduplicationKey: `story-volume:${args.cultivatorId}:1`,
      },
      tx,
    );
  }
}

export async function resolveMainStoryScene(args: {
  cultivatorId: string;
  nodeId: string;
  sceneKey: string;
  choiceId: string;
  requestId: string;
}): Promise<MainStoryMutationResult> {
  return db.transaction(async (tx) => {
    const dedupeKey = `resolve:${args.requestId}`;
    const replay = await findStoryEventByDedupeKey(
      args.cultivatorId,
      dedupeKey,
      tx,
    );
    const loaded = await loadOrInitializeStory(args.cultivatorId, tx);
    if (!loaded.progress || !loaded.actor || !loaded.progressId) {
      throw new StoryStateError(loaded.lockedReason ?? '主线尚未开启', 409);
    }
    if (replay) {
      const scene = globalPendingScene(loaded.progress, loaded.actor);
      return {
        story: buildStorySnapshot(loaded.progress),
        scene,
        continuation: scene
          ? null
          : buildStoryContinuation(loaded.progress, loaded.actor),
        replayed: true,
      };
    }
    if (loaded.progress.currentNodeId !== args.nodeId) {
      throw new StoryStateError('卷页已经变化，请刷新后再继续', 409);
    }

    const transition = resolveStoryChoice(
      loaded.progress,
      loaded.actor,
      args.sceneKey,
      args.choiceId,
    );
    const next = buildNextState(loaded.progress, transition);
    const saved = await updateStoryProgress(
      {
        id: loaded.progressId,
        expectedNodeId: loaded.progress.currentNodeId,
        expectedStep: loaded.progress.currentStep,
        next,
      },
      tx,
    );
    if (!saved) throw new StoryStateError('卷页已被其他请求推进，请刷新', 409);

    await appendStoryEvent(
      {
        cultivatorId: args.cultivatorId,
        nodeId: loaded.progress.currentNodeId,
        sceneKey: args.sceneKey,
        eventType: 'choice',
        choiceId: args.choiceId,
        payload: {
          fromStep: loaded.progress.currentStep,
          toNodeId: saved.currentNodeId,
          toStep: saved.currentStep,
          ...(transition.eventPayload ?? {}),
        },
        dedupeKey,
      },
      tx,
    );

    await emitStoryDomainEvents({
      cultivatorId: args.cultivatorId,
      before: loaded.progress,
      after: saved,
      choiceId: args.choiceId,
      tx,
    });

    const scene = globalPendingScene(saved, loaded.actor);
    return {
      story: buildStorySnapshot(saved),
      scene,
      continuation: scene ? null : buildStoryContinuation(saved, loaded.actor),
    };
  });
}

function runtimeTransition(
  progress: StoryProgressState,
  actor: StoryActorContext,
  eventType: MainStoryRuntimeEventType,
  payload: Record<string, unknown>,
): { next: StoryProgressState; handled: boolean } {
  const at = (nodeId: string, step: string) =>
    progress.currentNodeId === nodeId && progress.currentStep === step;
  const cast = VOLUME_ONE_SECT_CAST[actor.sectId];
  const payloadChoice = typeof payload.choice === 'string' ? payload.choice : '';
  const patch = (
    state: StoryProgressState,
    flags?: Record<string, string | boolean | number | null>,
    trust?: Record<string, number>,
  ): StoryProgressState => ({
    ...state,
    flags: applyFlagPatch(state.flags, flags),
    npcTrust: applyTrustDelta(state.npcTrust, trust),
  });

  if (eventType === 'v1_affairs_observed' && at('01-00', 'affairs')) {
    return { handled: true, next: { ...progress, currentStep: 'herb' } };
  }
  if (eventType === 'v1_herb_normal_observed' && at('01-00', 'herb')) {
    return { handled: true, next: { ...progress, currentStep: 'gate' } };
  }
  if (eventType === 'v1_gate_normal_observed' && at('01-00', 'gate')) {
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-01', currentStep: 'root' },
        { 'story.v1.prologue_done': true },
      ),
    };
  }

  if (eventType === 'v1_root_investigated' && at('01-01', 'root')) {
    if (!['keep', 'handover', 'destroy'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-02', currentStep: 'archive' },
        {
          'story.v1.root_anomaly_seen': true,
          'story.v1.root_sample_choice': payloadChoice,
        },
        payloadChoice === 'handover' && cast ? { [cast.herb]: 1 } : undefined,
      ),
    };
  }

  if (eventType === 'v1_archive_root_discussed' && at('01-02', 'archive')) {
    if (!['ask_person', 'ask_records', 'leave'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-03', currentStep: 'spring' },
        undefined,
        payloadChoice === 'leave' && cast ? { [cast.archive]: 1 } : undefined,
      ),
    };
  }

  if (eventType === 'v1_spring_moon_observed' && at('01-03', 'spring')) {
    if (!['report', 'conceal', 'joke'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-04', currentStep: 'auction' },
        {
          'story.v1.foreign_moon_seen': true,
          'story.v1.foreign_moon_report': payloadChoice,
        },
      ),
    };
  }

  if (eventType === 'v1_auction_future_listing_opened' && at('01-04', 'auction')) {
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-05', currentStep: 'black-market' },
        {
          'story.v1.future_listing_seen': true,
          'story.v1.future_listing_action': 'detail',
        },
      ),
    };
  }

  if (eventType === 'v1_auction_future_listing_resolved' && at('01-04', 'auction')) {
    const action = typeof payload.action === 'string' ? payload.action : 'cancel';
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-05', currentStep: 'black-market' },
        {
          'story.v1.future_listing_seen': true,
          'story.v1.future_listing_action': action,
        },
      ),
    };
  }

  if (eventType === 'v1_black_market_fragment_resolved' && at('01-05', 'black-market')) {
    if (!['buy', 'heed', 'hold'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-06', currentStep: 'lamps' },
        {
          'story.v1.black_fragment_seen': true,
          'story.v1.black_fragment_owned': payloadChoice === 'buy',
          'story.v1.silent_elder_warning': true,
        },
      ),
    };
  }

  if (eventType === 'v1_lamp_mismatch_verified' && at('01-06', 'lamps')) {
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-07', currentStep: 'await-dungeon' },
        {
          'story.v1.eighteenth_lamp': actor.sectId === 'youdu' ? 'seen' : 'heard',
        },
        cast ? { [cast.archive]: 1 } : undefined,
      ),
    };
  }

  // V1.1 仍会在副本结算时发送 dungeon_settlement。V1.2 明确忽略它：
  // 玩家必须在结算页亲手翻开石块并拾起残页，剧情才推进。
  if (eventType === 'dungeon_settlement') {
    return { handled: false, next: progress };
  }

  if (
    eventType === 'dungeon_blank_page_collected' &&
    at('01-07', 'await-dungeon') &&
    payload.nodeId === QINGXI_HERB_SLOPE_NODE_ID
  ) {
    return {
      handled: true,
      next: patch(
        { ...progress, currentStep: 'found-page' },
        { 'story.v1.blank_page_found': true },
      ),
    };
  }

  if (eventType === 'v1_blank_page_route_selected' && at('01-07', 'found-page')) {
    if (!['archive', 'elder', 'sell'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        {
          ...progress,
          currentNodeId: payloadChoice === 'archive' ? '01-08' : '01-07',
          currentStep:
            payloadChoice === 'archive'
              ? 'letters'
              : payloadChoice === 'elder'
                ? 'elder-check'
                : 'market-check',
        },
        { 'story.v1.blank_page_action': payloadChoice },
      ),
    };
  }

  if (eventType === 'v1_blank_page_elder_checked' && at('01-07', 'elder-check')) {
    return {
      handled: true,
      next: { ...progress, currentNodeId: '01-08', currentStep: 'letters' },
    };
  }

  if (eventType === 'v1_blank_page_market_checked' && at('01-07', 'market-check')) {
    return {
      handled: true,
      next: { ...progress, currentNodeId: '01-08', currentStep: 'letters' },
    };
  }

  if (eventType === 'v1_archive_letters_handled' && at('01-08', 'letters')) {
    if (!['ask', 'trust'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        { ...progress, currentNodeId: '01-09', currentStep: 'gate' },
        { 'story.v1.archive_network_hint': true },
        payloadChoice === 'trust' && cast ? { [cast.archive]: 1 } : undefined,
      ),
    };
  }

  if (eventType === 'v1_gate_ledger_resolved' && at('01-09', 'gate')) {
    if (!['follow', 'report', 'lock'].includes(payloadChoice)) {
      return { handled: false, next: progress };
    }
    return {
      handled: true,
      next: patch(
        {
          ...progress,
          currentNodeId: '01-10',
          currentStep: isFoundationOrAbove(actor.realm) ? 'voice' : 'await-breakthrough',
        },
        { 'story.v1.night_visitor_choice': payloadChoice },
        payloadChoice === 'lock' && cast ? { [cast.gate]: 1 } : undefined,
      ),
    };
  }

  // 兼容已经停在 V1.1 “pre-breakthrough” 的存档：不再弹文字场景，
  // 直接回到真实闭关/破境玩法等待。
  if (eventType === 'v1_pre_breakthrough_ready' && at('01-10', 'pre-breakthrough')) {
    return {
      handled: true,
      next: {
        ...progress,
        currentStep: isFoundationOrAbove(actor.realm) ? 'voice' : 'await-breakthrough',
      },
    };
  }

  if (
    eventType === 'breakthrough_success' &&
    at('01-10', 'await-breakthrough') &&
    isFoundationOrAbove(actor.realm)
  ) {
    return {
      handled: true,
      next: { ...progress, currentStep: 'voice' },
    };
  }

  if (eventType === 'v1_voice_heard' && at('01-10', 'voice')) {
    return {
      handled: true,
      next: patch(
        { ...progress, currentStep: 'report' },
        { 'story.v1.first_voice_heard': true },
      ),
    };
  }

  if (eventType === 'v1_archive_voice_reported' && at('01-10', 'report')) {
    return {
      handled: true,
      next: {
        ...progress,
        currentStep: 'complete',
        status: 'completed',
        completedAt: new Date(),
      },
    };
  }

  return { handled: false, next: progress };
}

async function applyRuntimeEventInTransaction(args: {
  cultivatorId: string;
  eventType: MainStoryRuntimeEventType;
  payload: Record<string, unknown>;
  dedupeKey: string;
  tx: DbTransaction;
  eventLogType?: string;
}): Promise<MainStoryMutationResult> {
  const replay = await findStoryEventByDedupeKey(
    args.cultivatorId,
    args.dedupeKey,
    args.tx,
  );
  const loaded = await loadOrInitializeStory(args.cultivatorId, args.tx);
  if (!loaded.progress || !loaded.actor || !loaded.progressId) {
    return {
      story: buildStorySnapshot(loaded.progress, loaded.lockedReason),
      scene: null,
      continuation: null,
      replayed: Boolean(replay),
    };
  }
  if (replay) {
    return {
      story: buildStorySnapshot(loaded.progress),
      scene: null,
      continuation: null,
      replayed: true,
    };
  }

  const transition = runtimeTransition(
    loaded.progress,
    loaded.actor,
    args.eventType,
    args.payload,
  );
  if (!transition.handled) {
    return {
      story: buildStorySnapshot(loaded.progress),
      scene: null,
      continuation: null,
    };
  }

  const saved = await updateStoryProgress(
    {
      id: loaded.progressId,
      expectedNodeId: loaded.progress.currentNodeId,
      expectedStep: loaded.progress.currentStep,
      next: transition.next,
    },
    args.tx,
  );
  if (!saved) throw new StoryStateError('卷页已被其他请求推进，请刷新', 409);

  await appendStoryEvent(
    {
      cultivatorId: args.cultivatorId,
      nodeId: loaded.progress.currentNodeId,
      eventType: args.eventLogType ?? args.eventType,
      payload: args.payload,
      dedupeKey: args.dedupeKey,
    },
    args.tx,
  );

  await emitStoryDomainEvents({
    cultivatorId: args.cultivatorId,
    before: loaded.progress,
    after: saved,
    eventType: args.eventType,
    tx: args.tx,
  });

  return {
    story: buildStorySnapshot(saved),
    scene: null,
    continuation:
      saved.currentStep === 'voice' || saved.currentStep === 'found-page'
        ? null
        : buildStoryContinuation(saved, loaded.actor),
  };
}

export async function notifyMainStoryRuntimeEvent(args: {
  cultivatorId: string;
  eventType: MainStoryRuntimeEventType;
  payload: Record<string, unknown>;
  requestId: string;
}): Promise<MainStoryMutationResult> {
  return db.transaction((tx) =>
    applyRuntimeEventInTransaction({
      cultivatorId: args.cultivatorId,
      eventType: args.eventType,
      payload: args.payload,
      dedupeKey: `runtime:${args.requestId}`,
      tx,
    }),
  );
}

export async function getMainStorySurface(args: {
  cultivatorId: string;
  surface: StorySurfaceKey;
  context?: StorySurfaceContext;
}): Promise<StorySurfaceResult> {
  return db.transaction(async (tx) => {
    const loaded = await loadOrInitializeStory(args.cultivatorId, tx);
    const story = buildStorySnapshot(loaded.progress, loaded.lockedReason);
    if (!loaded.progress || !loaded.actor || loaded.progress.status !== 'active') {
      return { story, surface: args.surface, entries: [] };
    }
    return {
      story,
      surface: args.surface,
      entries: buildVolumeOneSurface({
        progress: loaded.progress,
        actor: loaded.actor,
        surface: args.surface,
        context: args.context,
      }),
    };
  });
}

export async function interactMainStorySurface(args: {
  cultivatorId: string;
  interactionId: string;
  payload: Record<string, unknown>;
  requestId: string;
}): Promise<StorySurfaceInteractionResult> {
  return db.transaction(async (tx) => {
    const loaded = await loadOrInitializeStory(args.cultivatorId, tx);
    if (!loaded.progress || !loaded.actor) {
      throw new StoryStateError(loaded.lockedReason ?? '主线尚未开启', 409);
    }
    if (
      !isVolumeOneInteractionAvailable({
        progress: loaded.progress,
        actor: loaded.actor,
        interactionId: args.interactionId,
        payload: args.payload,
      })
    ) {
      throw new StoryStateError('这个剧情交互已经失效，请刷新当前场景', 409);
    }
    const command = resolveVolumeOneSurfaceInteraction(
      args.interactionId,
      args.payload,
    );
    if (!command) throw new StoryStateError('未知剧情交互', 404);

    const result = await applyRuntimeEventInTransaction({
      cultivatorId: args.cultivatorId,
      eventType: command.eventType,
      payload: command.payload,
      dedupeKey: `surface:${args.requestId}`,
      tx,
      eventLogType: `surface:${args.interactionId}`,
    });
    return {
      ...result,
      consumedInteractionId: args.interactionId,
    };
  });
}

/**
 * NATS/JetStream projector entrypoint. Cross-domain facts advance story state here,
 * not from dungeon/retreat React code. The consumer supplies its transaction so
 * message-consumption idempotency and story projection commit atomically.
 */
export async function projectMainStoryDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<void> {
  if (isDomainEventType(event, 'dungeon.run.settled')) {
    const loaded = await loadOrInitializeStory(event.data.cultivatorId, tx);
    if (!loaded.progress || !loaded.progressId) return;
    if (
      loaded.progress.currentNodeId !== '01-07' ||
      loaded.progress.currentStep !== 'await-dungeon' ||
      event.data.mapNodeId !== QINGXI_HERB_SLOPE_NODE_ID ||
      event.data.outcome !== 'completed'
    ) {
      return;
    }
    const next: StoryProgressState = {
      ...loaded.progress,
      flags: applyFlagPatch(loaded.progress.flags, {
        'story.v1.qingxi_settled': true,
      }),
    };
    const saved = await updateStoryProgress(
      {
        id: loaded.progressId,
        expectedNodeId: loaded.progress.currentNodeId,
        expectedStep: loaded.progress.currentStep,
        next,
      },
      tx,
    );
    if (!saved) return;
    await appendStoryEvent(
      {
        cultivatorId: event.data.cultivatorId,
        nodeId: loaded.progress.currentNodeId,
        eventType: 'domain:dungeon.run.settled',
        payload: {
          runId: event.data.runId,
          mapNodeId: event.data.mapNodeId,
          outcome: event.data.outcome,
        },
        dedupeKey: `domain:${event.id}`,
      },
      tx,
    );
    return;
  }

  if (isDomainEventType(event, 'cultivator.realm.changed')) {
    if (!event.data.major || !isFoundationOrAbove(event.data.toRealm)) return;
    await applyRuntimeEventInTransaction({
      cultivatorId: event.data.cultivatorId,
      eventType: 'breakthrough_success',
      payload: {
        fromRealm: event.data.fromRealm,
        toRealm: event.data.toRealm,
        actionInstanceId: event.data.actionInstanceId,
      },
      dedupeKey: `domain:${event.id}`,
      tx,
      eventLogType: 'domain:cultivator.realm.changed',
    });
  }
}

export function storyErrorStatus(error: unknown): 400 | 404 | 409 | 500 {
  return error instanceof StoryStateError ? error.status : 500;
}
