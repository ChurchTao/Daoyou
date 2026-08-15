import {
  startBattleResolutionConsumer,
  stopBattleResolutionConsumer,
} from '@server/lib/mq/battleResolutionConsumer';
import {
  startBattleTerminalFinalizerConsumer,
  stopBattleTerminalFinalizerConsumer,
} from '@server/lib/mq/battleTerminalFinalizerConsumer';
import { ensureMessageTopology } from '@server/lib/mq/natsTopology';
import { closeNatsConnection, getJetStreamClient } from '@server/lib/nats';
import { redis } from '@server/lib/redis';
import { ArenaRoomService } from '@server/lib/services/ArenaRoomService';
import {
  BATTLE_ONLINE_ALL_MATCHES_KEY,
  BATTLE_ONLINE_DEADLINE_CLAIMS_KEY,
  BATTLE_ONLINE_DEADLINES_KEY,
  BATTLE_ONLINE_RESOLVING_KEY,
  BATTLE_ONLINE_WAITING_CLAIMS_KEY,
  BATTLE_ONLINE_WAITING_KEY,
  BATTLE_RESOLUTION_TASK_PENDING_KEY,
  BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
  BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
  battleOnlineCommandReceiptsKey,
  battleOnlineEventSnapshotsKey,
  battleOnlineMatchKey,
  battleOnlinePresentationKey,
  battleReplayArchivePayloadKey,
  battleReplayRoundsKey,
  battleTerminalOutboxKey,
} from '@server/lib/services/BattleOnlineRedisKeys';
import {
  BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
  BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY,
  getBattleReplayArchivePointer,
} from '@server/lib/services/BattleReplayRedisStore';
import { publishPendingBattleResolutionTasks } from '@server/lib/services/BattleResolutionTaskPublisher';
import { finalizeBattleTerminalState } from '@server/lib/services/BattleTerminalFinalizer';
import { publishPendingBattleTerminalEvents } from '@server/lib/services/BattleTerminalOutboxPublisher';
import { encodeOnlineBattleBroadcastEvent } from '@server/lib/services/onlineBattleBroadcaster';
import { OnlineBattleCoordinator } from '@server/lib/services/OnlineBattleCoordinator';
import {
  createOnlineBattleIndexReconcileCursor,
  reconcileOnlineBattleIndexes,
} from '@server/lib/services/OnlineBattleIndexReconciler';
import {
  OnlineBattleResolutionError,
  type OnlineBattleRoundResolver,
} from '@server/lib/services/OnlineBattleResolverPool';
import {
  createOnlineBattleEventSnapshot,
  OnlineBattleStore,
  RESOLUTION_TASK_REPUBLISH_LEASE_MS,
} from '@server/lib/services/OnlineBattleStore';
import {
  consumeOnlineBattleTicket,
  issueOnlineBattleTicket,
} from '@server/lib/services/OnlineBattleTicketService';
import {
  BATTLE_RESOLUTION_STREAM,
  BATTLE_RESOLUTION_SUBJECT,
  type BattleResolutionTaskV1,
} from '@shared/contracts/battleResolutionTask';
import { ONLINE_BATTLE_ACCEPT_TIMEOUT_MS } from '@shared/contracts/onlineBattleRuntime';
import { resolveBattleRound } from '@shared/engine/battle-v5/round/BattleRoundResolver';
import { JSONCodec } from 'nats';
import {
  basicIntentsForPlayer,
  createOnlineBattleFixture,
} from './online-battle-fixture';

assertIsolatedRedis(process.env.REDIS_URL);

const directResolver: OnlineBattleRoundResolver = {
  resolve: async (battle, commandSet) => resolveBattleRound(battle, commandSet),
  close() {},
};
const transientResolver: OnlineBattleRoundResolver = {
  resolve: async () => {
    throw new OnlineBattleResolutionError(
      'fault injected transient resolver failure',
      'transient_infrastructure',
      'E2E_TRANSIENT_FAILURE',
    );
  },
  close() {},
};
const deterministicFailureResolver: OnlineBattleRoundResolver = {
  resolve: async () => {
    throw new Error('fault injected deterministic resolver failure');
  },
  close() {},
};

const touchedMatchIds: string[] = [];
const touchedArenaRooms: Array<{
  roomId: string;
  inviteCode: string;
  userIds: string[];
  cultivatorIds: string[];
}> = [];
try {
  await redis.ping();
  await ensureMessageTopology();
  await startBattleTerminalFinalizerConsumer();
  await runEventSnapshotRetentionScenario();
  await runPresentingEventSnapshotScenario();
  await runEventSnapshotCasConflictScenario();
  await runRestartAndMultiInstanceScenario();
  await runCommandIdempotencyLifecycleScenario();
  await runFinishedArchiveScenario();
  await runUnifiedCancellationScenario();
  await runIndexClaimAndReconcileScenario();
  await runLostPublishedResolutionTaskScenario();
  await runJetStreamResolutionPointerScenario();
  await runCorruptRuntimeDiscardScenario();
  await runWrongTypeRuntimeReconcileScenario();
  await runCorruptArenaRuntimeFallbackScenario();
  await runCorruptArenaIndexCleanupScenario();
  await runMissingPresentationDiscardScenario();
  await runCorruptTerminalOutboxRepairScenario();
  await runWrongTypeTerminalOutboxRepairScenario();
  await runMissingTerminalOutboxReconcileScenario();
  await runTechnicalAbortOutboxScenario();
  await runTerminalFinalizerScenario();
  console.info('online battle Redis restart and multi-instance E2E passed');
} finally {
  await stopBattleResolutionConsumer();
  await stopBattleTerminalFinalizerConsumer();
  for (const matchId of touchedMatchIds) await cleanupMatch(matchId);
  for (const room of touchedArenaRooms) await cleanupArenaRoom(room);
  redis.disconnect(false);
  await closeNatsConnection();
}

async function runEventSnapshotRetentionScenario(): Promise<void> {
  const state = createOnlineBattleFixture(uniqueMatchId('event-snapshots'), 1);
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });

  let current = await store.get(state.matchId);
  for (let index = 1; index <= 18; index += 1) {
    const next = {
      ...current,
      storageRevision: current.storageRevision + 1,
      clientEventSeq: current.clientEventSeq + 1,
      match: {
        ...current.match,
        revision: current.match.revision + 1,
        updatedAt: current.match.updatedAt + 1,
      },
    };
    assert(
      await store.compareAndSet(
        current,
        next,
        undefined,
        createOnlineBattleEventSnapshot(next),
      ),
      `event snapshot CAS ${index} failed`,
    );
    current = next;
  }

  const snapshotKey = battleOnlineEventSnapshotsKey(state.matchId);
  assert(
    (await redis.hlen(snapshotKey)) === 16,
    'event snapshot Hash exceeded its 16-entry bound',
  );
  const ttl = await redis.ttl(snapshotKey);
  assert(
    ttl > 0 && ttl <= 30,
    `event snapshot Hash TTL was outside the 30-second bound: ${ttl}`,
  );
  assert(
    (await store.getEventSnapshot(state.matchId, 2)) === null &&
      (await store.getEventSnapshot(state.matchId, 3))?.eventSeq === 3,
    'event snapshot pruning did not retain exactly the latest 16 events',
  );
  const historical = await coordinator.playerViewAtEvent(
    state.matchId,
    state.controllers[0]!.playerId,
    17,
  );
  const latest = await coordinator.playerViewLatest(
    state.matchId,
    state.controllers[0]!.playerId,
  );
  assert(
    historical?.clientEventSeq === 17 && latest.clientEventSeq === 18,
    'historical event view was replaced by the latest runtime',
  );
  assert(
    (await coordinator.playerViewAtEvent(
      state.matchId,
      state.controllers[0]!.playerId,
      999,
    )) === null && latest.clientEventSeq === current.clientEventSeq,
    'event snapshot miss did not preserve the latest real event sequence',
  );

  await redis.hset(snapshotKey, '17', '{}');
  assert(
    (await store.getEventSnapshot(state.matchId, 17)) === null &&
      (await redis.hexists(snapshotKey, '17')) === 0 &&
      (await redis.exists(battleOnlineMatchKey(state.matchId))) === 1,
    'corrupt event snapshot removal affected more than its Hash field',
  );
  coordinator.close();
}

async function runPresentingEventSnapshotScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('presenting-event-snapshot'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  await coordinator.resumeResolution(state.matchId);
  const latest = await coordinator.playerViewLatest(
    state.matchId,
    state.controllers[0]!.playerId,
  );
  assert(
    latest.status === 'presenting' && latest.roundResult,
    'fixture did not reach a presenting event',
  );
  await redis.del(battleOnlinePresentationKey(state.matchId));
  const exact = await coordinator.playerViewAtEvent(
    state.matchId,
    state.controllers[0]!.playerId,
    latest.clientEventSeq,
  );
  assert(
    exact?.status === 'presenting' &&
      exact.roundResult?.resultId === latest.roundResult.resultId,
    'presenting event snapshot depended on the mutable presentation key',
  );
  coordinator.close();
}

async function runEventSnapshotCasConflictScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('event-snapshot-conflict'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  const current = await store.get(state.matchId);
  const winner = {
    ...current,
    storageRevision: current.storageRevision + 1,
    match: {
      ...current.match,
      revision: current.match.revision + 1,
      updatedAt: current.match.updatedAt + 1,
    },
  };
  assert(
    await store.compareAndSet(current, winner),
    'event snapshot conflict fixture could not advance the winner state',
  );
  const stale = {
    ...current,
    storageRevision: current.storageRevision + 1,
    clientEventSeq: current.clientEventSeq + 1,
    match: {
      ...current.match,
      revision: current.match.revision + 2,
      updatedAt: current.match.updatedAt + 2,
    },
  };
  assert(
    !(await store.compareAndSet(
      current,
      stale,
      undefined,
      createOnlineBattleEventSnapshot(stale),
    )) &&
      (await redis.hexists(
        battleOnlineEventSnapshotsKey(state.matchId),
        String(stale.clientEventSeq),
      )) === 0,
    'CAS conflict left an orphan event snapshot',
  );
  coordinator.close();
}

async function runCommandIdempotencyLifecycleScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('command-idempotency'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map(
      (controller) => controller.playerId,
    ),
  });
  const playerId = state.controllers[0]!.playerId;
  const firstRequestId = crypto.randomUUID();
  const first = await coordinator.submitRound({
    matchId: state.matchId,
    playerId,
    requestId: firstRequestId,
    round: 999,
    checkpointRevision: 0,
    intents: basicIntentsForPlayer(state, playerId),
  });
  assert(first.status === 'rejected', 'invalid command was not rejected');
  for (let index = 1; index < 300; index += 1) {
    const receipt = await coordinator.submitRound({
      matchId: state.matchId,
      playerId,
      requestId: crypto.randomUUID(),
      round: 999,
      checkpointRevision: index,
      intents: basicIntentsForPlayer(state, playerId),
    });
    assert(
      receipt.status === 'rejected',
      'invalid command receipt was not retained',
    );
  }
  assert(
    (await redis.hlen(battleOnlineCommandReceiptsKey(state.matchId))) === 300,
    'command receipt history was truncated before match lifecycle ended',
  );
  const duplicate = await coordinator.submitRound({
    matchId: state.matchId,
    playerId,
    requestId: firstRequestId,
    round: 999,
    checkpointRevision: 0,
    intents: basicIntentsForPlayer(state, playerId),
  });
  assert(
    duplicate.status === first.status &&
      duplicate.reason === first.reason &&
      duplicate.receivedAt === first.receivedAt,
    'old command requestId did not preserve its original semantic result',
  );
  const runtimeJson = await redis.hget(
    battleOnlineMatchKey(state.matchId),
    'state',
  );
  assert(
    runtimeJson !== null &&
      !runtimeJson.includes('processedCommandReceipts') &&
      !runtimeJson.includes('commandReceiptsByPlayerId'),
    'command receipt history leaked back into the authoritative runtime payload',
  );
  const hint = encodeOnlineBattleBroadcastEvent({
    kind: 'state_changed',
    matchId: state.matchId,
    revision: 1,
    eventSeq: 1,
  });
  assert(
    new TextEncoder().encode(hint).byteLength < 512,
    'NATS Core hint is too large',
  );
  for (const forbidden of [
    'checkpoint',
    'blueprint',
    'facts',
    'result',
    'publicSnapshot',
  ]) {
    assert(!hint.includes(forbidden), `NATS Core hint contains ${forbidden}`);
  }
  coordinator.close();
}

async function runUnifiedCancellationScenario(): Promise<void> {
  const waitingState = createOnlineBattleFixture(
    uniqueMatchId('accept-timeout'),
    1,
  );
  touchedMatchIds.push(waitingState.matchId);
  const waitingCoordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await waitingCoordinator.createMatch({
    match: waitingState,
    acceptedPlayerIds: [waitingState.controllers[0]!.playerId],
  });
  const invitedPlayerId = waitingState.controllers[1]!.playerId;
  assert(
    (await redis.zscore(
      `battle:invites:user:${invitedPlayerId}`,
      waitingState.matchId,
    )) !== null,
    'match creation did not atomically create the participant invitation',
  );
  assert(
    await waitingCoordinator.expireWaiting(
      waitingState.matchId,
      waitingState.createdAt + ONLINE_BATTLE_ACCEPT_TIMEOUT_MS,
    ),
    'waiting acceptance timeout did not enter cancelled',
  );
  const waitingOutbox = await waitingCoordinator.store.getTerminalOutbox(
    waitingState.matchId,
  );
  assert(
    waitingOutbox?.event.terminalReason === 'accept_timeout',
    'waiting timeout did not use the terminal outbox',
  );
  assert(
    (await waitingCoordinator.runtimeDiagnostic(waitingState.matchId))
      .status === 'cancelled',
    'waiting timeout deleted the runtime instead of preserving cancelled state',
  );
  await publishPendingBattleTerminalEvents(waitingCoordinator.store);
  await waitUntil(
    async () =>
      (await redis.hget(
        battleTerminalOutboxKey(waitingState.matchId),
        'cleanup_status',
      )) === 'completed',
  );
  assert(
    (await redis.zscore(
      `battle:invites:user:${invitedPlayerId}`,
      waitingState.matchId,
    )) === null,
    'terminal cleanup left a stale battle invitation index',
  );
  const terminalBeforeLateAccept = await redis.hmget(
    battleOnlineMatchKey(waitingState.matchId),
    'state_id',
    'state',
  );
  await waitingCoordinator
    .acceptPlayer(waitingState.matchId, invitedPlayerId)
    .then(() => {
      throw new Error('cancelled match accepted a late player');
    })
    .catch((error: unknown) => {
      assert(
        String(error).includes('no longer accepts players'),
        'cancelled match returned the wrong late-accept failure',
      );
    });
  assert(
    JSON.stringify(
      await redis.hmget(
        battleOnlineMatchKey(waitingState.matchId),
        'state_id',
        'state',
      ),
    ) === JSON.stringify(terminalBeforeLateAccept),
    'late accept mutated the cancelled authoritative runtime',
  );
  waitingCoordinator.close();

  const planningState = createOnlineBattleFixture(
    uniqueMatchId('planning-abort'),
    1,
  );
  touchedMatchIds.push(planningState.matchId);
  const planningCoordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await planningCoordinator.createMatch({
    match: planningState,
    acceptedPlayerIds: planningState.controllers.map(
      (controller) => controller.playerId,
    ),
  });
  assert(
    await planningCoordinator.technicalAbort(planningState.matchId),
    'planning technical abort did not enter cancelled',
  );
  assert(
    (await planningCoordinator.store.getTerminalOutbox(planningState.matchId))
      ?.event.terminalReason === 'technical_abort',
    'planning technical abort did not atomically stage terminal cleanup',
  );
  planningCoordinator.close();
}

async function runIndexClaimAndReconcileScenario(): Promise<void> {
  const now = Date.now();
  const waitingFixture = createOnlineBattleFixture(
    uniqueMatchId('index-claim'),
    1,
  );
  const waitingState = {
    ...waitingFixture,
    createdAt: now - ONLINE_BATTLE_ACCEPT_TIMEOUT_MS - 1_000,
    updatedAt: now - ONLINE_BATTLE_ACCEPT_TIMEOUT_MS - 1_000,
  };
  touchedMatchIds.push(waitingState.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: waitingState,
    acceptedPlayerIds: [waitingState.controllers[0]!.playerId],
  });

  const orphanIds = Array.from(
    { length: 100 },
    (_, index) => `a-orphan-${String(index).padStart(3, '0')}`,
  );
  await redis.zadd(
    BATTLE_ONLINE_WAITING_KEY,
    ...orphanIds.flatMap((matchId) => [0, matchId]),
  );
  const firstClaim = await store.claimExpiredWaitingMatchIds(now, 100);
  assert(
    !firstClaim.includes(waitingState.matchId) && firstClaim.length === 100,
    'orphan waiting entries did not occupy the first bounded claim batch',
  );
  await Promise.all(
    firstClaim.map(async (matchId) => {
      await coordinator.expireWaiting(matchId, now).catch(() => undefined);
    }),
  );
  const secondClaim = await store.claimExpiredWaitingMatchIds(now, 100);
  assert(
    secondClaim.includes(waitingState.matchId),
    'a real expired match starved behind orphan waiting entries',
  );
  assert(
    await coordinator.expireWaiting(waitingState.matchId, now),
    'claimed real waiting match did not advance to cancelled',
  );
  await store.reconcileMatchIndexes(waitingState.matchId);
  assert(
    (await coordinator.runtimeDiagnostic(waitingState.matchId)).status ===
      'cancelled',
    'claimed real waiting match did not persist its terminal state',
  );
  assert(
    (await redis.zcard(BATTLE_ONLINE_WAITING_CLAIMS_KEY)) === 0,
    'completed or orphan waiting claims were not released',
  );

  const repairState = createOnlineBattleFixture(
    uniqueMatchId('index-repair'),
    1,
  );
  touchedMatchIds.push(repairState.matchId);
  await coordinator.createMatch({
    match: repairState,
    acceptedPlayerIds: repairState.controllers.map((entry) => entry.playerId),
  });
  await redis
    .multi()
    .srem(BATTLE_ONLINE_ALL_MATCHES_KEY, repairState.matchId)
    .zrem(BATTLE_ONLINE_DEADLINES_KEY, repairState.matchId)
    .del(BATTLE_ONLINE_DEADLINE_CLAIMS_KEY)
    .set(BATTLE_ONLINE_DEADLINE_CLAIMS_KEY, 'wrong-type-derived-index')
    .exec();
  let cursor = createOnlineBattleIndexReconcileCursor();
  for (let iteration = 0; iteration < 20; iteration += 1) {
    cursor = await reconcileOnlineBattleIndexes(store, cursor, 100);
    if (cursor.runtime === '0') break;
  }
  assert(
    (await redis.sismember(
      BATTLE_ONLINE_ALL_MATCHES_KEY,
      repairState.matchId,
    )) === 1,
    'authoritative runtime scan did not restore the active match index',
  );
  assert(
    (await redis.zscore(BATTLE_ONLINE_DEADLINES_KEY, repairState.matchId)) !==
      null,
    'authoritative runtime scan did not restore the deadline index',
  );
  assert(
    ['none', 'zset'].includes(
      await redis.type(BATTLE_ONLINE_DEADLINE_CLAIMS_KEY),
    ),
    'wrong-type derived scheduling index was not replaced',
  );
  coordinator.close();
}

async function runJetStreamResolutionPointerScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('resolution-pointer'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  let resolutionCalls = 0;
  const countingResolver: OnlineBattleRoundResolver = {
    async resolve(battle, commandSet) {
      if (commandSet.commandSetId.startsWith(`${state.matchId}:`)) {
        resolutionCalls += 1;
      }
      return resolveBattleRound(battle, commandSet);
    },
    close() {},
  };
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    countingResolver,
  );
  await startBattleResolutionConsumer(coordinator);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  const delivery = await coordinator.store.getResolutionTaskDelivery(
    state.matchId,
  );
  assert(
    delivery,
    'resolving transition did not atomically stage a task pointer',
  );
  const serializedTask = JSON.stringify(delivery.task);
  assert(
    Buffer.byteLength(serializedTask) < 1_024 &&
      !serializedTask.includes('checkpoint') &&
      !serializedTask.includes('blueprint'),
    'resolution task contains battle payload instead of a small Redis pointer',
  );
  await publishPendingBattleResolutionTasks(coordinator.store);
  await publishPendingBattleResolutionTasks(coordinator.store);
  await waitUntil(
    async () =>
      (await coordinator.runtimeDiagnostic(state.matchId)).status ===
      'presenting',
  );
  assert(
    resolutionCalls === 1,
    'one durable resolution task executed more than once',
  );
  const jetStream = await getJetStreamClient();
  await jetStream.publish(
    BATTLE_RESOLUTION_SUBJECT,
    JSONCodec<BattleResolutionTaskV1>().encode(delivery.task),
    {
      msgID: `${delivery.task.taskId}:stale-replay`,
      expect: { streamName: BATTLE_RESOLUTION_STREAM },
    },
  );
  await Bun.sleep(100);
  assert(
    resolutionCalls === 1,
    'a stale resolution pointer recomputed the round',
  );
  await stopBattleResolutionConsumer();
  coordinator.close();
}

async function runLostPublishedResolutionTaskScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('lost-resolution-task'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  const firstDelivery = await coordinator.store.getResolutionTaskDelivery(
    state.matchId,
  );
  assert(firstDelivery, 'lost-task fixture did not stage a resolution pointer');
  assert(
    await coordinator.store.markResolutionTaskPublished(
      state.matchId,
      firstDelivery.task,
      firstDelivery.publishAttempt,
    ),
    'lost-task fixture could not simulate a published pointer',
  );
  await redis.hset(
    battleOnlineMatchKey(state.matchId),
    'resolution_task_published_at',
    String(Date.now() - RESOLUTION_TASK_REPUBLISH_LEASE_MS - 1),
  );
  assert(
    (await redis.sismember(
      BATTLE_RESOLUTION_TASK_PENDING_KEY,
      state.matchId,
    )) === 0,
    'published task unexpectedly remained pending',
  );
  assert(
    await coordinator.scheduleResolution(state.matchId),
    'expired published task was not restaged',
  );
  assert(
    (await redis.sismember(
      BATTLE_RESOLUTION_TASK_PENDING_KEY,
      state.matchId,
    )) === 1 &&
      (await redis.hget(
        battleOnlineMatchKey(state.matchId),
        'resolution_task_status',
      )) === 'pending',
    'expired published task did not return to the durable Redis outbox',
  );
  const republishedDelivery = await coordinator.store.getResolutionTaskDelivery(
    state.matchId,
  );
  assert(
    republishedDelivery?.publishAttempt === firstDelivery.publishAttempt + 1,
    'expired task did not advance its JetStream publish generation',
  );
  coordinator.close();
}

async function runCorruptRuntimeDiscardScenario(): Promise<void> {
  const state = createOnlineBattleFixture(uniqueMatchId('corrupt-runtime'), 1);
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  await redis
    .multi()
    .hset(
      battleOnlineMatchKey(state.matchId),
      'state',
      JSON.stringify({
        version: 'unsupported_runtime',
      }),
    )
    .zadd(BATTLE_ONLINE_WAITING_KEY, 0, state.matchId)
    .zadd(BATTLE_ONLINE_DEADLINE_CLAIMS_KEY, 0, state.matchId)
    .zadd(BATTLE_ONLINE_WAITING_CLAIMS_KEY, 0, state.matchId)
    .sadd(BATTLE_RESOLUTION_TASK_PENDING_KEY, state.matchId)
    .exec();
  await store.get(state.matchId).catch(() => undefined);
  assert(
    (await redis.exists(battleOnlineMatchKey(state.matchId))) === 0,
    'unsupported runtime was not discarded',
  );
  assert(
    (await redis.sismember(BATTLE_ONLINE_ALL_MATCHES_KEY, state.matchId)) ===
      0 &&
      (await redis.zscore(BATTLE_ONLINE_DEADLINES_KEY, state.matchId)) ===
        null &&
      (await redis.zscore(BATTLE_ONLINE_WAITING_KEY, state.matchId)) === null &&
      (await redis.sismember(
        BATTLE_RESOLUTION_TASK_PENDING_KEY,
        state.matchId,
      )) === 0,
    'discarded runtime left active scheduling indexes behind',
  );
  const outbox = await store.getTerminalOutbox(state.matchId);
  assert(
    outbox?.event.terminalReason === 'corrupt_runtime',
    'discarded runtime did not stage terminal cleanup',
  );
  coordinator.close();
}

async function runWrongTypeRuntimeReconcileScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('wrong-type-runtime'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  await redis
    .multi()
    .del(battleOnlineMatchKey(state.matchId))
    .set(battleOnlineMatchKey(state.matchId), 'wrong-type-runtime')
    .exec();
  let cursor = createOnlineBattleIndexReconcileCursor();
  for (let iteration = 0; iteration < 20; iteration += 1) {
    cursor = await reconcileOnlineBattleIndexes(store, cursor, 100);
    if (cursor.runtime === '0') break;
  }
  assert(
    (await redis.exists(battleOnlineMatchKey(state.matchId))) === 0 &&
      (await redis.sismember(
        BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
        state.matchId,
      )) === 1,
    'wrong-type runtime escaped authoritative reconciliation cleanup',
  );
  coordinator.close();
}

async function runMissingPresentationDiscardScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('missing-presentation'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  await coordinator.resumeResolution(state.matchId);
  await redis.del(battleOnlinePresentationKey(state.matchId));
  await coordinator
    .playerViewLatest(state.matchId, state.controllers[0]!.playerId)
    .then(
      () => {
        throw new Error('missing presentation blob was accepted');
      },
      () => undefined,
    );
  assert(
    (await redis.exists(battleOnlineMatchKey(state.matchId))) === 0 &&
      (await redis.sismember(
        BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
        state.matchId,
      )) === 1,
    'missing presentation blob did not terminate and clean the match',
  );
  coordinator.close();
}

async function runCorruptTerminalOutboxRepairScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('corrupt-terminal-outbox'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  assert(
    await coordinator.technicalAbort(state.matchId),
    'terminal repair fixture could not enter cancelled',
  );
  await redis
    .multi()
    .hset(battleTerminalOutboxKey(state.matchId), 'publish_status', 'published')
    .srem(BATTLE_TERMINAL_OUTBOX_PENDING_KEY, state.matchId)
    .srem(BATTLE_TERMINAL_CLEANUP_PENDING_KEY, state.matchId)
    .exec();
  await store.reconcileTerminalOutboxTracking(state.matchId);
  assert(
    (await redis.sismember(
      BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
      state.matchId,
    )) === 1,
    'terminal outbox scan did not rebuild lost cleanup tracking',
  );
  await redis
    .multi()
    .hset(battleTerminalOutboxKey(state.matchId), 'event', '{}')
    .hdel(battleTerminalOutboxKey(state.matchId), 'manifest')
    .exec();
  const repaired = await store.getTerminalOutbox(state.matchId);
  assert(
    repaired?.event.terminalStatus === 'cancelled' &&
      repaired.event.terminalReason === 'corrupt_runtime',
    'corrupt terminal outbox was not rebuilt into a safe cleanup task',
  );
  await finalizeBattleTerminalState(store, repaired);
  assert(
    (await redis.sismember(
      BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
      state.matchId,
    )) === 0,
    'repaired terminal outbox did not complete cleanup',
  );
  coordinator.close();
}

async function runWrongTypeTerminalOutboxRepairScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('wrong-type-terminal-outbox'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  assert(
    await coordinator.technicalAbort(state.matchId),
    'wrong-type terminal fixture could not enter cancelled',
  );
  await redis
    .multi()
    .del(battleTerminalOutboxKey(state.matchId))
    .set(battleTerminalOutboxKey(state.matchId), 'wrong-type-outbox')
    .srem(BATTLE_TERMINAL_OUTBOX_PENDING_KEY, state.matchId)
    .srem(BATTLE_TERMINAL_CLEANUP_PENDING_KEY, state.matchId)
    .exec();
  let cursor = createOnlineBattleIndexReconcileCursor();
  for (let iteration = 0; iteration < 20; iteration += 1) {
    cursor = await reconcileOnlineBattleIndexes(store, cursor, 100);
    if (cursor.terminalOutbox === '0') break;
  }
  const repaired = await store.getTerminalOutbox(state.matchId);
  assert(
    repaired?.event.terminalStatus === 'cancelled' &&
      (await redis.type(battleTerminalOutboxKey(state.matchId))) === 'hash' &&
      (await redis.sismember(
        BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
        state.matchId,
      )) === 1,
    'wrong-type terminal outbox was not replaced and retracked',
  );
  coordinator.close();
}

async function runMissingTerminalOutboxReconcileScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('missing-terminal-outbox'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
  });
  assert(
    await coordinator.technicalAbort(state.matchId),
    'missing terminal fixture could not enter cancelled',
  );
  await redis
    .multi()
    .del(battleTerminalOutboxKey(state.matchId))
    .srem(BATTLE_TERMINAL_OUTBOX_PENDING_KEY, state.matchId)
    .srem(BATTLE_TERMINAL_CLEANUP_PENDING_KEY, state.matchId)
    .exec();
  let cursor = createOnlineBattleIndexReconcileCursor();
  for (let iteration = 0; iteration < 20; iteration += 1) {
    cursor = await reconcileOnlineBattleIndexes(store, cursor, 100);
    if (cursor.runtime === '0') break;
  }
  assert(
    (await redis.sismember(
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      state.matchId,
    )) === 1 &&
      (await store.getTerminalOutbox(state.matchId))?.event.terminalStatus ===
        'cancelled',
    'terminal runtime did not rebuild a deleted outbox and tracking',
  );
  coordinator.close();
}

async function runCorruptArenaRuntimeFallbackScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('corrupt-arena-runtime'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const [alpha, beta] = state.controllers;
  const alphaCultivatorId = alpha?.unitIds[0];
  const betaCultivatorId = beta?.unitIds[0];
  if (!alpha || !beta || !alphaCultivatorId || !betaCultivatorId) {
    throw new Error('Corrupt arena fixture controllers missing');
  }
  const rooms = new ArenaRoomService();
  let room = await rooms.createRoom({
    userId: alpha.playerId,
    cultivatorId: alphaCultivatorId,
    displayName: alpha.playerId,
    realm: '炼气',
    realmStage: '初期',
  });
  room = await rooms.joinRoom({
    inviteCode: room.inviteCode,
    userId: beta.playerId,
    cultivatorId: betaCultivatorId,
    displayName: beta.playerId,
    realm: '炼气',
    realmStage: '初期',
  });
  room = await rooms.setReady(room.roomId, alpha.playerId, true);
  room = await rooms.setReady(room.roomId, beta.playerId, true);
  const startRequestId = crypto.randomUUID();
  room = await rooms.start(room.roomId, alpha.playerId, startRequestId);
  touchedArenaRooms.push({
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    userIds: [alpha.playerId, beta.playerId],
    cultivatorIds: [alphaCultivatorId, betaCultivatorId],
  });
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
    orchestration: {
      kind: 'arena_sparring_v1',
      roomId: room.roomId,
      startRequestId,
    },
  });
  await rooms.attachBattleMatch(room.roomId, startRequestId, state.matchId);
  await redis.hset(
    battleOnlineMatchKey(state.matchId),
    'state',
    JSON.stringify({ version: 'unsupported_runtime' }),
    'cleanup_manifest',
    '{corrupt',
  );
  await coordinator.store.get(state.matchId).catch(() => undefined);
  assert(
    (await rooms.getRoom(room.roomId)) === null,
    'corrupt arena room was not released',
  );
  assert(
    (await rooms.getRoomForUser(alpha.playerId)) === null &&
      (await rooms.getRoomForUser(beta.playerId)) === null,
    'corrupt arena player occupancy was not released from reverse-index fallback',
  );
  assert(
    (await rooms.getRoomForCultivator(alphaCultivatorId)) === null &&
      (await rooms.getRoomForCultivator(betaCultivatorId)) === null,
    'corrupt arena cultivator occupancy was not released from reverse-index fallback',
  );
  coordinator.close();
}

async function runCorruptArenaIndexCleanupScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('corrupt-arena-index'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const [alpha, beta] = state.controllers;
  const alphaCultivatorId = alpha?.unitIds[0];
  const betaCultivatorId = beta?.unitIds[0];
  if (!alpha || !beta || !alphaCultivatorId || !betaCultivatorId) {
    throw new Error('Corrupt arena index fixture controllers missing');
  }
  const rooms = new ArenaRoomService();
  let room = await rooms.createRoom({
    userId: alpha.playerId,
    cultivatorId: alphaCultivatorId,
    displayName: alpha.playerId,
    realm: '炼气',
    realmStage: '初期',
  });
  room = await rooms.joinRoom({
    inviteCode: room.inviteCode,
    userId: beta.playerId,
    cultivatorId: betaCultivatorId,
    displayName: beta.playerId,
    realm: '炼气',
    realmStage: '初期',
  });
  room = await rooms.setReady(room.roomId, alpha.playerId, true);
  room = await rooms.setReady(room.roomId, beta.playerId, true);
  const startRequestId = crypto.randomUUID();
  room = await rooms.start(room.roomId, alpha.playerId, startRequestId);
  touchedArenaRooms.push({
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    userIds: [alpha.playerId, beta.playerId],
    cultivatorIds: [alphaCultivatorId, betaCultivatorId],
  });
  const store = new OnlineBattleStore();
  const coordinator = new OnlineBattleCoordinator(store, directResolver);
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map((entry) => entry.playerId),
    orchestration: {
      kind: 'arena_sparring_v1',
      roomId: room.roomId,
      startRequestId,
    },
  });
  await rooms.attachBattleMatch(room.roomId, startRequestId, state.matchId);
  await redis
    .multi()
    .del(`arena:battle-room:v1:${state.matchId}`)
    .hset(`arena:battle-room:v1:${state.matchId}`, 'corrupt', '1')
    .del(`arena:user-room:v1:${alpha.playerId}`)
    .hset(`arena:user-room:v1:${alpha.playerId}`, 'corrupt', '1')
    .exec();
  assert(
    await coordinator.technicalAbort(state.matchId),
    'corrupt arena index fixture could not enter cancelled',
  );
  const outbox = await store.getTerminalOutbox(state.matchId);
  if (!outbox) throw new Error('Corrupt arena index terminal outbox missing');
  await finalizeBattleTerminalState(store, outbox);
  assert(
    (await rooms.getRoom(room.roomId)) === null &&
      (await redis.exists(`arena:user-room:v1:${alpha.playerId}`)) === 0 &&
      (await rooms.getRoomForUser(beta.playerId)) === null &&
      (await rooms.getRoomForCultivator(alphaCultivatorId)) === null &&
      (await rooms.getRoomForCultivator(betaCultivatorId)) === null,
    'terminal cleanup did not remove wrong-type arena reverse indexes',
  );
  coordinator.close();
}

async function runRestartAndMultiInstanceScenario(): Promise<void> {
  const state = createOnlineBattleFixture(uniqueMatchId('restart'), 2);
  touchedMatchIds.push(state.matchId);
  const [alpha, beta] = state.controllers;
  if (!alpha || !beta) throw new Error('Restart fixture controllers missing');
  const first = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    transientResolver,
  );
  const second = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    transientResolver,
  );
  await first.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map(
      (controller) => controller.playerId,
    ),
  });
  const initialPlanningView = await first.playerViewLatest(
    state.matchId,
    alpha.playerId,
  );
  assert(
    initialPlanningView.status === 'planning' &&
      initialPlanningView.planningView !== undefined &&
      initialPlanningView.deadlineAt !== undefined,
    'fully accepted match did not expose an actionable planning snapshot',
  );

  const ticket = await issueOnlineBattleTicket({
    matchId: state.matchId,
    playerId: alpha.playerId,
  });
  assert(
    (await consumeOnlineBattleTicket(ticket))?.playerId === alpha.playerId,
    'socket ticket did not resolve identity',
  );
  assert(
    (await consumeOnlineBattleTicket(ticket)) === null,
    'socket ticket was reusable',
  );

  const alphaRequestId = crypto.randomUUID();
  const alphaIntents = basicIntentsForPlayer(state, alpha.playerId);
  const [alphaFirst, alphaRace] = await Promise.all([
    first.submitRound({
      matchId: state.matchId,
      playerId: alpha.playerId,
      requestId: alphaRequestId,
      round: 1,
      checkpointRevision: 0,
      intents: alphaIntents,
    }),
    second.submitRound({
      matchId: state.matchId,
      playerId: alpha.playerId,
      requestId: alphaRequestId,
      round: 1,
      checkpointRevision: 0,
      intents: alphaIntents,
    }),
  ]);
  assert(
    alphaFirst.status === 'accepted' &&
      alphaRace.status === alphaFirst.status &&
      alphaRace.matchRevision === alphaFirst.matchRevision &&
      alphaRace.receivedAt === alphaFirst.receivedAt,
    'cross-instance request idempotency failed',
  );
  await second.submitRound({
    matchId: state.matchId,
    playerId: beta.playerId,
    requestId: crypto.randomUUID(),
    round: 1,
    checkpointRevision: 0,
    intents: basicIntentsForPlayer(state, beta.playerId),
  });
  await second.resumeResolution(state.matchId);
  assert(
    (await second.runtimeDiagnostic(state.matchId)).resolutionRetry?.attempt ===
      1,
    'transient resolution failure did not persist retry metadata',
  );
  first.close();
  second.close();

  const restarted = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  const retry = (await restarted.runtimeDiagnostic(state.matchId))
    .resolutionRetry;
  assert(retry, 'resolving retry was not durable across coordinator restart');
  await Bun.sleep(Math.max(0, retry.nextRetryAt - Date.now()) + 20);
  await restarted.resumeResolution(state.matchId);
  const presenting = await restarted.runtimeDiagnostic(state.matchId);
  assert(
    presenting.status === 'presenting',
    'restart did not recover resolving',
  );
  const view = await restarted.playerViewLatest(state.matchId, alpha.playerId);
  assert(view.roundResult, 'presenting window did not survive Redis reload');

  const duplicateAfterPhaseChange = await restarted.submitRound({
    matchId: state.matchId,
    playerId: alpha.playerId,
    requestId: alphaRequestId,
    round: 1,
    checkpointRevision: 0,
    intents: alphaIntents,
  });
  assert(
    duplicateAfterPhaseChange.status === alphaFirst.status &&
      duplicateAfterPhaseChange.matchRevision === alphaFirst.matchRevision &&
      duplicateAfterPhaseChange.receivedAt === alphaFirst.receivedAt,
    'request receipt did not survive phase change',
  );

  for (const controller of state.controllers) {
    await restarted.presentationReady({
      matchId: state.matchId,
      playerId: controller.playerId,
      round: view.roundResult.plan.round,
      resultId: view.roundResult.resultId,
      requestId: crypto.randomUUID(),
    });
  }
  const afterReady = await restarted.playerViewLatest(
    state.matchId,
    alpha.playerId,
  );
  assert(
    afterReady.clientEventSeq === view.clientEventSeq,
    'presentation Ready incorrectly created another client-visible round result',
  );
  assert(
    Number(
      await redis.zscore(BATTLE_ONLINE_DEADLINES_KEY, state.matchId),
    ) === view.roundResult.scheduledEndsAt,
    'presentation Ready moved the Redis deadline before scheduledEndsAt',
  );
  await Bun.sleep(
    Math.max(0, view.roundResult.scheduledEndsAt - Date.now()) + 20,
  );
  await restarted.resolveDeadline(state.matchId);
  const nextPhase = await restarted.runtimeDiagnostic(state.matchId);
  assert(
    nextPhase.status === 'planning' || nextPhase.status === 'finished',
    'durable Ready deadline did not advance',
  );
  restarted.close();
}

async function runFinishedArchiveScenario(): Promise<void> {
  let state = createOnlineBattleFixture(uniqueMatchId('archive'), 1);
  touchedMatchIds.push(state.matchId);
  const betaUnitId = state.controllers.find(
    (controller) => controller.teamId === 'beta',
  )?.unitIds[0];
  if (!betaUnitId) throw new Error('Archive fixture beta unit missing');
  state = {
    ...state,
    battle: {
      ...state.battle,
      checkpoint: {
        ...state.battle.checkpoint,
        units: {
          ...state.battle.checkpoint.units,
          [betaUnitId]: {
            ...state.battle.checkpoint.units[betaUnitId]!,
            hp: 1,
          },
        },
      },
    },
  };
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    directResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map(
      (controller) => controller.playerId,
    ),
  });
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  await coordinator.resumeResolution(state.matchId);
  const view = await coordinator.playerViewLatest(
    state.matchId,
    state.controllers[0]!.playerId,
  );
  if (!view.roundResult)
    throw new Error('Archive fixture presentation missing');
  const persistedRuntime = await redis.hget(
    battleOnlineMatchKey(state.matchId),
    'state',
  );
  assert(
    persistedRuntime !== null &&
      !persistedRuntime.includes('presentationWindow') &&
      !persistedRuntime.includes('pendingPresentationWindow') &&
      (await redis.exists(battleOnlinePresentationKey(state.matchId))) === 1,
    'presentation payload was not isolated from the authoritative runtime',
  );
  await Bun.sleep(
    Math.max(0, view.roundResult.scheduledEndsAt - Date.now()) + 20,
  );
  await coordinator.resolveDeadline(state.matchId);
  const diagnostic = await coordinator.runtimeDiagnostic(state.matchId);
  assert(
    diagnostic.status === 'finished',
    'near-defeated match did not finish',
  );
  assert(
    (await redis.exists(battleOnlinePresentationKey(state.matchId))) === 0,
    'terminal transition retained the transient presentation blob',
  );
  assert(
    (await redis.hget(
      battleReplayArchivePayloadKey(state.matchId),
      'archive_status',
    )) === 'pending',
    'finished replay was not atomically staged for archive',
  );
  const archivePointer = await getBattleReplayArchivePointer(state.matchId);
  assert(
    archivePointer?.expectedStorageRevision === diagnostic.storageRevision,
    'finished replay pointer does not target the terminal storage revision',
  );
  assert(
    (await coordinator.store.buildReplayArchive(
      state.matchId,
      diagnostic.storageRevision,
    )) !== null,
    'archive consumer could not rebuild replay from Redis source material',
  );
  await redis.srem(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, state.matchId);
  let reconcileCursor = createOnlineBattleIndexReconcileCursor();
  for (let iteration = 0; iteration < 20; iteration += 1) {
    reconcileCursor = await reconcileOnlineBattleIndexes(
      coordinator.store,
      reconcileCursor,
      100,
    );
    if (reconcileCursor.replayArchive === '0') break;
  }
  assert(
    (await redis.sismember(
      BATTLE_REPLAY_ARCHIVE_PENDING_KEY,
      state.matchId,
    )) === 1,
    'archive pointer scan did not rebuild lost pending tracking',
  );
  await redis
    .multi()
    .del(battleReplayArchivePayloadKey(state.matchId))
    .set(battleReplayArchivePayloadKey(state.matchId), 'wrong-type-pointer')
    .exec();
  const repairedArchivePointer = await getBattleReplayArchivePointer(
    state.matchId,
  );
  assert(
    repairedArchivePointer?.expectedStorageRevision ===
      diagnostic.storageRevision &&
      (await redis.type(battleReplayArchivePayloadKey(state.matchId))) ===
        'hash',
    'wrong-type replay archive pointer was not rebuilt from terminal runtime',
  );
  await redis
    .multi()
    .del(battleReplayRoundsKey(state.matchId))
    .set(battleReplayRoundsKey(state.matchId), 'wrong-type-replay-source')
    .exec();
  assert(
    (await coordinator.store.buildReplayArchive(
      state.matchId,
      diagnostic.storageRevision,
    )) === null,
    'wrong-type replay source remained an infinitely retrying poison item',
  );
  const archiveMetadata = await redis.hgetall(
    battleReplayArchivePayloadKey(state.matchId),
  );
  assert(
    new TextEncoder().encode(JSON.stringify(archiveMetadata)).byteLength <
      1_024 && !('replay' in archiveMetadata),
    'terminal CAS embedded the full replay in archive metadata',
  );
  assert(
    (await redis.sismember(
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      state.matchId,
    )) === 1,
    'finished terminal event was not atomically staged',
  );
  assert(
    (await redis.sismember(BATTLE_ONLINE_ALL_MATCHES_KEY, state.matchId)) === 0,
    'finished match remained in active match index',
  );
  coordinator.close();
}

async function runTechnicalAbortOutboxScenario(): Promise<void> {
  const state = createOnlineBattleFixture(uniqueMatchId('technical-abort'), 1);
  touchedMatchIds.push(state.matchId);
  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    deterministicFailureResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map(
      (controller) => controller.playerId,
    ),
  });
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  await coordinator.resumeResolution(state.matchId);
  assert(
    (await coordinator.runtimeDiagnostic(state.matchId)).status ===
      'resolution_failed',
    'deterministic resolution failure did not enter resolution_failed',
  );
  assert(
    await coordinator.technicalAbort(state.matchId),
    'technical abort did not change state',
  );
  const outbox = await coordinator.store.getTerminalOutbox(state.matchId);
  assert(
    outbox?.event.terminalStatus === 'cancelled',
    'cancelled terminal event missing',
  );
  assert(
    outbox.event.terminalReason === 'technical_abort',
    'technical abort reason was not preserved',
  );
  assert(
    (await redis.sismember(BATTLE_ONLINE_ALL_MATCHES_KEY, state.matchId)) === 0,
    'cancelled match remained in active match index',
  );
  coordinator.close();
}

async function runTerminalFinalizerScenario(): Promise<void> {
  const state = createOnlineBattleFixture(
    uniqueMatchId('terminal-finalizer'),
    1,
  );
  touchedMatchIds.push(state.matchId);
  const [alpha, beta] = state.controllers;
  if (!alpha || !beta)
    throw new Error('Terminal finalizer controllers missing');
  const [alphaCultivatorId] = alpha.unitIds;
  const [betaCultivatorId] = beta.unitIds;
  if (!alphaCultivatorId || !betaCultivatorId) {
    throw new Error('Terminal finalizer cultivators missing');
  }

  const rooms = new ArenaRoomService();
  let room = await rooms.createRoom({
    userId: alpha.playerId,
    cultivatorId: alphaCultivatorId,
    displayName: alpha.playerId,
    realm: '炼气',
    realmStage: '初期',
  });
  room = await rooms.joinRoom({
    inviteCode: room.inviteCode,
    userId: beta.playerId,
    cultivatorId: betaCultivatorId,
    displayName: beta.playerId,
    realm: '炼气',
    realmStage: '初期',
  });
  room = await rooms.setReady(room.roomId, alpha.playerId, true);
  room = await rooms.setReady(room.roomId, beta.playerId, true);
  const startRequestId = crypto.randomUUID();
  room = await rooms.start(room.roomId, alpha.playerId, startRequestId);
  touchedArenaRooms.push({
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    userIds: [alpha.playerId, beta.playerId],
    cultivatorIds: [alphaCultivatorId, betaCultivatorId],
  });

  const coordinator = new OnlineBattleCoordinator(
    new OnlineBattleStore(),
    deterministicFailureResolver,
  );
  await coordinator.createMatch({
    match: state,
    acceptedPlayerIds: state.controllers.map(
      (controller) => controller.playerId,
    ),
    orchestration: {
      kind: 'arena_sparring_v1',
      roomId: room.roomId,
      startRequestId,
    },
  });
  await rooms.attachBattleMatch(room.roomId, startRequestId, state.matchId);
  for (const controller of state.controllers) {
    await coordinator.submitRound({
      matchId: state.matchId,
      playerId: controller.playerId,
      requestId: crypto.randomUUID(),
      round: 1,
      checkpointRevision: 0,
      intents: basicIntentsForPlayer(state, controller.playerId),
    });
  }
  await coordinator.resumeResolution(state.matchId);
  assert(
    (await coordinator.runtimeDiagnostic(state.matchId)).status ===
      'resolution_failed',
    'terminal finalizer fixture did not enter resolution_failed',
  );
  assert(
    await coordinator.technicalAbort(state.matchId),
    'terminal finalizer abort failed',
  );
  await publishPendingBattleTerminalEvents(coordinator.store);
  await waitUntil(
    async () =>
      (await redis.hget(
        battleTerminalOutboxKey(state.matchId),
        'cleanup_status',
      )) === 'completed',
  );
  assert(
    (await rooms.getRoom(room.roomId)) === null,
    'terminal room was not removed',
  );
  assert(
    (await rooms.getRoomForUser(alpha.playerId)) === null &&
      (await rooms.getRoomForUser(beta.playerId)) === null,
    'terminal player occupancy was not released',
  );
  assert(
    (await rooms.getRoomForCultivator(alphaCultivatorId)) === null &&
      (await rooms.getRoomForCultivator(betaCultivatorId)) === null,
    'terminal cultivator occupancy was not released',
  );
  assert(
    (await coordinator.store.findArenaMatch(room.roomId, startRequestId)) ===
      null,
    'terminal arena start index was not released',
  );
  assert(
    (await redis.sismember(
      BATTLE_TERMINAL_OUTBOX_PENDING_KEY,
      state.matchId,
    )) === 0 &&
      (await redis.sismember(
        BATTLE_TERMINAL_CLEANUP_PENDING_KEY,
        state.matchId,
      )) === 0,
    'terminal outbox tracking remained pending after cleanup',
  );
  coordinator.close();
}

async function cleanupMatch(matchId: string): Promise<void> {
  await redis
    .multi()
    .del(
      battleOnlineMatchKey(matchId),
      battleOnlineCommandReceiptsKey(matchId),
      battleOnlineEventSnapshotsKey(matchId),
      battleOnlinePresentationKey(matchId),
      battleReplayArchivePayloadKey(matchId),
      battleReplayRoundsKey(matchId),
      battleTerminalOutboxKey(matchId),
    )
    .srem(BATTLE_ONLINE_ALL_MATCHES_KEY, matchId)
    .srem(BATTLE_ONLINE_RESOLVING_KEY, matchId)
    .srem(BATTLE_RESOLUTION_TASK_PENDING_KEY, matchId)
    .zrem(BATTLE_ONLINE_DEADLINES_KEY, matchId)
    .zrem(BATTLE_ONLINE_DEADLINE_CLAIMS_KEY, matchId)
    .zrem(BATTLE_ONLINE_WAITING_KEY, matchId)
    .zrem(BATTLE_ONLINE_WAITING_CLAIMS_KEY, matchId)
    .srem(BATTLE_REPLAY_ARCHIVE_PENDING_KEY, matchId)
    .zrem(BATTLE_REPLAY_ARCHIVE_UNCONFIRMED_KEY, matchId)
    .srem(BATTLE_TERMINAL_OUTBOX_PENDING_KEY, matchId)
    .srem(BATTLE_TERMINAL_CLEANUP_PENDING_KEY, matchId)
    .exec();
}

async function cleanupArenaRoom(room: {
  roomId: string;
  inviteCode: string;
  userIds: string[];
  cultivatorIds: string[];
}): Promise<void> {
  await redis.del(
    `arena:room:v1:${room.roomId}`,
    `arena:room:v1:${room.roomId}:revision`,
    `arena:room-code:v1:${room.inviteCode}`,
    ...room.userIds.map((userId) => `arena:user-room:v1:${userId}`),
    ...room.cultivatorIds.map(
      (cultivatorId) => `arena:cultivator-room:v1:${cultivatorId}`,
    ),
  );
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() >= deadline) throw new Error('Online battle E2E timed out');
    await Bun.sleep(20);
  }
}

function uniqueMatchId(scenario: string): string {
  return `e2e-${scenario}-${crypto.randomUUID()}`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertIsolatedRedis(redisUrl: string | undefined): void {
  if (!redisUrl) throw new Error('REDIS_URL is required for Redis E2E');
  const url = new URL(redisUrl);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  const database = Number(url.pathname.slice(1));
  if (!local || !Number.isInteger(database) || database < 14) {
    throw new Error(
      'Redis E2E requires localhost and isolated database 14 or 15',
    );
  }
}
