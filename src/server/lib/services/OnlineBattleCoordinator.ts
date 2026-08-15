import {
  BATTLE_REPLAY_ROUND_MAX_SERIALIZED_BYTES,
  type BattleReplayRoundResolutionV1,
} from '@shared/contracts/battleReplay';
import type { BattleResolutionTaskV1 } from '@shared/contracts/battleResolutionTask';
import type { BattleTerminalEventV1 } from '@shared/contracts/battleTerminal';
import type { OnlineBattlePlayerViewV2 } from '@shared/contracts/onlineBattle';
import {
  ONLINE_BATTLE_ACCEPT_TIMEOUT_MS,
  ONLINE_BATTLE_RESOLUTION_FAILURE_TIMEOUT_MS,
  type OnlineBattleCommandReceiptRecordV1,
} from '@shared/contracts/onlineBattleRuntime';
import {
  applyBattleRoundResolution,
  cancelBattleMatch,
  completeBattlePresentation,
  createBattleMatchPlayerView,
  createBattleMatchViewProjection,
  holdBattleMatchForPlayers,
  markBattlePresentationReady,
  markBattleResolutionFailed,
  openBattlePlanning,
  retryFailedBattleResolution,
  transitionBattleMatch,
} from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import { createBattlePublicSnapshot } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import type {
  BattleCommandReceiptV1,
  ClientBattleIntentV1,
} from '@shared/engine/battle-v5/match/types';
import { resolveBattleAbilityVisual } from '@shared/engine/battle-v5/presentation';
import type { BattleRoundResolutionV1 } from '@shared/engine/battle-v5/round/types';
import {
  BATTLE_PRESENTATION_MAX_SERIALIZED_BYTES,
  battlePresentationSerializedBytes,
  compactBattlePresentationWindow,
  createBattlePresentationWindow,
  createBattleRoundPlaybackPlan,
  type CompactBattlePresentationWindowV1,
} from '@shared/online-battle/BattlePresentation';
import { createHash } from 'node:crypto';
import { observeOnlineBattleMetric } from './OnlineBattleMetrics';
import {
  OnlineBattleResolutionError,
  OnlineBattleResolverPool,
  type OnlineBattleRoundResolver,
} from './OnlineBattleResolverPool';
import {
  advanceOnlineBattleRuntime,
  createOnlineBattleRuntimeState,
  type OnlineBattleOrchestrationV1,
  type OnlineBattleRuntimeStateV1,
} from './OnlineBattleRuntimeState';
import {
  MAX_SOCKET_MESSAGE_BYTES,
  onlineBattleMessageByteLength,
} from './OnlineBattleSocketPolicy';
import {
  createOnlineBattleEventSnapshot,
  OnlineBattleStore,
  type OnlineBattleEventSnapshotV1,
} from './OnlineBattleStore';
import { publishOnlineBattleEvent } from './onlineBattleBroadcaster';

const MAX_CAS_ATTEMPTS = 8;
const MAX_AUTOMATIC_RESOLUTION_ATTEMPTS = 5;
const RESOLUTION_RETRY_DELAYS_MS = [250, 1_000, 3_000, 10_000, 30_000] as const;

export class OnlineBattleCoordinator {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly projectionCache = new Map<
    string,
    {
      projectionKey: string;
      projection: ReturnType<typeof createBattleMatchViewProjection>;
    }
  >();
  private readonly eventSnapshotCache = new Map<
    string,
    Promise<OnlineBattleEventSnapshotV1 | null>
  >();

  constructor(
    readonly store = new OnlineBattleStore(),
    private readonly resolver: OnlineBattleRoundResolver = new OnlineBattleResolverPool(),
  ) {}

  async createMatch(input: {
    readonly match: Parameters<
      typeof createOnlineBattleRuntimeState
    >[0]['match'];
    readonly acceptedPlayerIds: readonly string[];
    readonly orchestration?: OnlineBattleOrchestrationV1;
  }): Promise<string> {
    const allAccepted = input.match.controllers.every((controller) =>
      input.acceptedPlayerIds.includes(controller.playerId),
    );
    const waiting = holdBattleMatchForPlayers(input.match);
    const match = allAccepted
      ? openBattlePlanning(waiting, Date.now())
      : waiting;
    await this.store.create(
      createOnlineBattleRuntimeState({ ...input, match }),
    );
    return match.matchId;
  }

  acceptPlayer(matchId: string, playerId: string): Promise<boolean> {
    return this.run(matchId, async () => {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const current = await this.store.get(matchId);
        if (
          !current.match.controllers.some(
            (entry) => entry.playerId === playerId,
          )
        ) {
          throw new Error('Player is not a battle controller');
        }
        if (current.acceptedPlayerIds.includes(playerId)) return false;
        if (current.match.status !== 'waiting') {
          throw new Error(
            `Battle match no longer accepts players: ${current.match.status}`,
          );
        }
        const acceptedPlayerIds = [
          ...current.acceptedPlayerIds,
          playerId,
        ].sort();
        const allAccepted = current.match.controllers.every((controller) =>
          acceptedPlayerIds.includes(controller.playerId),
        );
        const next = this.advance(current, {
          acceptedPlayerIds,
          match: allAccepted
            ? openBattlePlanning(current.match, Date.now())
            : current.match,
        });
        if (await this.compareAndSet(current, next)) {
          this.publish(current, next);
          return true;
        }
      }
      throw new Error('Battle player acceptance conflict');
    });
  }

  submitRound(input: {
    readonly matchId: string;
    readonly playerId: string;
    readonly requestId: string;
    readonly round: number;
    readonly checkpointRevision: number;
    readonly intents: Readonly<Record<string, ClientBattleIntentV1>>;
  }): Promise<BattleCommandReceiptV1> {
    return this.run(input.matchId, async () => {
      const payloadHash = commandPayloadHash({
        round: input.round,
        checkpointRevision: input.checkpointRevision,
        intents: input.intents,
      });
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const prior = await this.store.getCommandReceipt(
          input.matchId,
          input.playerId,
          input.requestId,
        );
        if (prior) {
          assertMatchingCommandReceipt(prior, 'round.submit', payloadHash);
          return prior.receipt;
        }
        const current = await this.store.get(input.matchId);
        const now = Date.now();
        try {
          if (!current.acceptedPlayerIds.includes(input.playerId)) {
            throw new Error('Player has not accepted the battle');
          }
          if (current.match.planning?.round !== input.round) {
            throw new Error('Battle planning round is stale');
          }
          const transition = transitionBattleMatch(
            current.match,
            {
              type: 'commit_player_intents',
              matchId: input.matchId,
              requestId: `${input.playerId}:${input.requestId}`,
              playerId: input.playerId,
              expectedMatchRevision: current.match.revision,
              expectedCheckpointRevision: input.checkpointRevision,
              intents: input.intents,
            },
            now,
          );
          const receipt: BattleCommandReceiptV1 = {
            requestId: input.requestId,
            status: 'accepted',
            matchRevision: transition.state.revision,
            checkpointRevision:
              transition.state.battle.checkpoint.checkpointRevision,
            receivedAt: now,
          };
          const next = this.advance(current, {
            match: transition.state,
          });
          const commandReceipt = createCommandReceiptRecord(
            input.playerId,
            'round.submit',
            payloadHash,
            receipt,
          );
          if (await this.compareAndSet(current, next, commandReceipt)) {
            this.publish(current, next);
            return receipt;
          }
        } catch (error) {
          const receipt: BattleCommandReceiptV1 = {
            requestId: input.requestId,
            status: 'rejected',
            reason: rejectionReason(error),
            matchRevision: current.match.revision,
            checkpointRevision:
              current.match.battle.checkpoint.checkpointRevision,
            receivedAt: now,
          };
          const stored = await this.store.storeCommandReceiptAtRevision(
            input.matchId,
            current.storageRevision,
            createCommandReceiptRecord(
              input.playerId,
              'round.submit',
              payloadHash,
              receipt,
            ),
          );
          if (stored === 'stored') return receipt;
          continue;
        }
      }
      throw new Error('Battle round submission conflict');
    });
  }

  presentationReady(input: {
    readonly matchId: string;
    readonly playerId: string;
    readonly resultId: string;
    readonly round: number;
    readonly requestId: string;
  }): Promise<BattleCommandReceiptV1> {
    return this.run(input.matchId, async () => {
      const payloadHash = commandPayloadHash({
        round: input.round,
        resultId: input.resultId,
      });
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const prior = await this.store.getCommandReceipt(
          input.matchId,
          input.playerId,
          input.requestId,
        );
        if (prior) {
          assertMatchingCommandReceipt(
            prior,
            'presentation.ready',
            payloadHash,
          );
          return prior.receipt;
        }
        const current = await this.store.get(input.matchId);
        const now = Date.now();
        try {
          if (current.match.presentation?.round !== input.round) {
            throw new Error('Battle presentation round is stale');
          }
          const updated = markBattlePresentationReady(
            current.match,
            input.playerId,
            input.resultId,
            now,
          );
          const receipt: BattleCommandReceiptV1 = {
            requestId: input.requestId,
            status:
              updated.revision === current.match.revision
                ? 'duplicate'
                : 'accepted',
            matchRevision: updated.revision,
            checkpointRevision: updated.battle.checkpoint.checkpointRevision,
            receivedAt: now,
          };
          const commandReceipt = createCommandReceiptRecord(
            input.playerId,
            'presentation.ready',
            payloadHash,
            receipt,
          );
          if (updated.revision === current.match.revision) {
            const stored = await this.store.storeCommandReceiptAtRevision(
              input.matchId,
              current.storageRevision,
              commandReceipt,
            );
            if (stored === 'stored') return receipt;
            continue;
          }
          const next = this.advance(current, {
            match: updated,
          });
          if (await this.compareAndSet(current, next, commandReceipt)) {
            this.publish(current, next);
            return receipt;
          }
        } catch (error) {
          const receipt: BattleCommandReceiptV1 = {
            requestId: input.requestId,
            status: 'rejected',
            reason: rejectionReason(error),
            matchRevision: current.match.revision,
            checkpointRevision:
              current.match.battle.checkpoint.checkpointRevision,
            receivedAt: now,
          };
          const stored = await this.store.storeCommandReceiptAtRevision(
            input.matchId,
            current.storageRevision,
            createCommandReceiptRecord(
              input.playerId,
              'presentation.ready',
              payloadHash,
              receipt,
            ),
          );
          if (stored === 'stored') return receipt;
        }
      }
      throw new Error('Battle presentation Ready conflict');
    });
  }

  async resolveDeadline(matchId: string): Promise<boolean> {
    const scheduled = await this.store.get(matchId);
    const scheduledAt =
      scheduled.resolutionRetry?.nextRetryAt ??
      scheduled.match.planning?.deadlineAt ??
      scheduled.match.presentation?.scheduledEndsAt;
    if (scheduledAt !== undefined) {
      observeOnlineBattleMetric(
        'scheduler_lag_ms',
        Math.max(0, Date.now() - scheduledAt),
      );
    }
    if (
      scheduled.match.status === 'resolving' &&
      scheduled.resolutionRetry &&
      Date.now() >= scheduled.resolutionRetry.nextRetryAt
    ) {
      return this.scheduleResolution(matchId);
    }
    return this.run(matchId, async () => {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const current = await this.store.get(matchId);
        const now = Date.now();
        let match = current.match;
        if (match.status === 'presenting') {
          if (match.presentation) {
            // Ready acknowledgements are informational only; the
            // authoritative presentation boundary remains scheduledEndsAt.
            observeOnlineBattleMetric(
              'ready_wait_ms',
              Math.max(0, now - match.presentation.startedAt),
            );
            if (
              match.presentation.readyPlayerIds.length <
              current.acceptedPlayerIds.length
            ) {
              observeOnlineBattleMetric('presentation_forced_end_total');
            }
          }
          match = completeBattlePresentation(match, now);
        } else if (
          match.status === 'planning' &&
          match.planning &&
          now >= match.planning.deadlineAt
        ) {
          const controller = new Set(
            match.controllers.flatMap((entry) => entry.unitIds),
          );
          const submitted = new Set(Object.keys(match.planning.submissions));
          observeOnlineBattleMetric(
            'default_action_total',
            [...controller].filter((unitId) => !submitted.has(unitId)).length,
          );
          match = transitionBattleMatch(
            match,
            {
              type: 'resolve_planning_timeout',
              matchId,
              requestId: `timeout:${matchId}:${match.planning.round}:${match.planning.checkpointRevision}`,
              expectedMatchRevision: match.revision,
              expectedCheckpointRevision: match.planning.checkpointRevision,
            },
            now,
          ).state;
        } else if (
          match.status === 'resolution_failed' &&
          match.resolving?.failure &&
          now >=
            match.resolving.failure.failedAt +
              ONLINE_BATTLE_RESOLUTION_FAILURE_TIMEOUT_MS
        ) {
          match = cancelBattleMatch(match, now);
        } else {
          return false;
        }
        if (match.revision === current.match.revision) return false;
        const next = this.advance(current, {
          match,
          ...(match.status === 'cancelled'
            ? {
                termination: {
                  reason: 'resolution_freeze_timeout' as const,
                  requestedAt: now,
                },
              }
            : {}),
        });
        if (await this.compareAndSet(current, next)) {
          this.publish(current, next);
          return true;
        }
      }
      throw new Error('Battle deadline transition conflict');
    });
  }

  resumeResolution(
    matchId: string,
    expectedTask?: BattleResolutionTaskV1,
  ): Promise<boolean> {
    return this.run(matchId, async () => {
      const current = await this.store.get(matchId);
      const resolving = current.match.resolving;
      if (current.match.status !== 'resolving' || !resolving) return false;
      if (
        expectedTask &&
        (current.storageRevision !== expectedTask.expectedStorageRevision ||
          current.match.revision !== expectedTask.expectedMatchRevision ||
          resolving.commandSet.commandSetId !== expectedTask.commandSetId)
      )
        return false;
      const attemptStartedAt = Date.now();
      if (
        current.resolutionRetry &&
        attemptStartedAt < current.resolutionRetry.nextRetryAt
      ) {
        return false;
      }
      let nextMatch;
      let pendingPresentationWindow: OnlineBattleRuntimeStateV1['pendingPresentationWindow'];
      let replay: OnlineBattleRuntimeStateV1['replay'];
      let resolutionRetry: OnlineBattleRuntimeStateV1['resolutionRetry'];
      try {
        const resolution = await this.resolver.resolve(
          current.match.battle,
          resolving.commandSet,
        );
        const resolvedAt = Date.now();
        pendingPresentationWindow = createPresentationWindow(
          current,
          resolution,
          resolvedAt,
        );
        nextMatch = applyBattleRoundResolution(
          current.match,
          resolution,
          resolvedAt,
          {
            resultId: pendingPresentationWindow.resultId,
            startedAt: pendingPresentationWindow.startedAt,
            readyAcceptedAt: pendingPresentationWindow.readyAcceptedAt,
            scheduledEndsAt: pendingPresentationWindow.scheduledEndsAt,
          },
        );
        replay = appendReplayRound(current, resolution);
        resolutionRetry = undefined;
        const candidate = this.advance(current, {
          match: nextMatch,
          pendingPresentationWindow,
          replay,
          resolutionRetry,
        });
        assertPlayerSnapshotsFit(candidate, pendingPresentationWindow);
      } catch (error) {
        pendingPresentationWindow = undefined;
        replay = current.replay;
        if (
          error instanceof OnlineBattleResolutionError &&
          error.code === 'RESOLVER_STOPPED'
        ) {
          return false;
        }
        const failedAt = Date.now();
        const failure = classifyResolutionFailure(error);
        const attempt = (current.resolutionRetry?.attempt ?? 0) + 1;
        if (
          failure.kind === 'transient_infrastructure' &&
          attempt <= MAX_AUTOMATIC_RESOLUTION_ATTEMPTS
        ) {
          observeOnlineBattleMetric('resolution_retry_total');
          nextMatch = current.match;
          resolutionRetry = {
            attempt,
            nextRetryAt: failedAt + RESOLUTION_RETRY_DELAYS_MS[attempt - 1]!,
            lastFailureCode: failure.code,
            lastFailureFingerprint: resolutionFailureFingerprint(failure),
            firstFailedAt: current.resolutionRetry?.firstFailedAt ?? failedAt,
            lastFailedAt: failedAt,
          };
        } else {
          observeOnlineBattleMetric('resolution_failed_total');
          nextMatch = markBattleResolutionFailed(
            current.match,
            error,
            failedAt,
          );
          resolutionRetry = undefined;
        }
        console.error('[online-battle] resolution attempt failed', {
          matchId,
          commandSetId: resolving.commandSet.commandSetId,
          error: error instanceof Error ? error.message : String(error),
          failureKind: failure.kind,
          attempt,
        });
      }
      observeOnlineBattleMetric(
        'resolve_duration_ms',
        Math.max(0, Date.now() - attemptStartedAt),
      );
      const next = this.advance(current, {
        match: nextMatch,
        pendingPresentationWindow,
        replay,
        resolutionRetry,
      });
      if (!(await this.compareAndSet(current, next))) return false;
      this.publish(current, next);
      return true;
    });
  }

  async scheduleResolution(matchId: string): Promise<boolean> {
    const current = await this.store.get(matchId);
    return this.store.stageResolutionTask(current);
  }

  retryResolution(matchId: string): Promise<boolean> {
    return this.run(matchId, async () => {
      const current = await this.store.get(matchId);
      const match = retryFailedBattleResolution(current.match, Date.now());
      if (match.revision === current.match.revision) return false;
      const next = this.advance(current, {
        match,
        resolutionRetry: undefined,
      });
      if (!(await this.compareAndSet(current, next))) return false;
      this.publish(current, next);
      return true;
    });
  }

  technicalAbort(matchId: string): Promise<boolean> {
    return this.cancelMatch(matchId, 'technical_abort');
  }

  expireWaiting(matchId: string, now = Date.now()): Promise<boolean> {
    return this.run(matchId, async () => {
      const current = await this.store.get(matchId);
      if (
        current.match.status !== 'waiting' ||
        now < current.match.createdAt + ONLINE_BATTLE_ACCEPT_TIMEOUT_MS
      )
        return false;
      return this.commitCancellation(current, 'accept_timeout', now);
    });
  }

  async runtimeDiagnostic(matchId: string) {
    const [runtime, processedCommandReceiptCount] = await Promise.all([
      this.store.get(matchId),
      this.store.countCommandReceipts(matchId),
    ]);
    const { match } = runtime;
    return {
      protocolVersion: 2 as const,
      matchId: match.matchId,
      status: match.status,
      matchRevision: match.revision,
      storageRevision: runtime.storageRevision,
      checkpointRevision: match.battle.checkpoint.checkpointRevision,
      round: match.battle.checkpoint.round,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      acceptedPlayerCount: runtime.acceptedPlayerIds.length,
      controllerCount: match.controllers.length,
      planning: match.planning
        ? {
            round: match.planning.round,
            opensAt: match.planning.opensAt,
            deadlineAt: match.planning.deadlineAt,
            committedPlayerCount: match.planning.committedPlayerIds.length,
            submittedUnitCount: Object.keys(match.planning.submissions).length,
          }
        : undefined,
      resolving: match.resolving
        ? {
            round: match.resolving.commandSet.round,
            checkpointRevision: match.resolving.commandSet.checkpointRevision,
            startedAt: match.resolving.startedAt,
            failureCode: match.resolving.failure?.code,
            failureFingerprint: match.resolving.failure?.fingerprint,
            failedAt: match.resolving.failure?.failedAt,
          }
        : undefined,
      resolutionRetry: runtime.resolutionRetry,
      presentation: match.presentation
        ? {
            resultId: match.presentation.resultId,
            round: match.presentation.round,
            startedAt: match.presentation.startedAt,
            readyAcceptedAt: match.presentation.readyAcceptedAt,
            scheduledEndsAt: match.presentation.scheduledEndsAt,
            readyPlayerCount: match.presentation.readyPlayerIds.length,
          }
        : undefined,
      processedCommandReceiptCount,
      replayRoundPending: Boolean(runtime.replay.pendingRound),
      orchestration: runtime.orchestration
        ? {
            kind: runtime.orchestration.kind,
            roomId: runtime.orchestration.roomId,
          }
        : undefined,
    };
  }

  async syncCursor(matchId: string, playerId: string) {
    const cursor = await this.store.getSyncCursor(matchId, playerId);
    return {
      revision: cursor.revision,
      eventSeq: cursor.eventSeq,
      serverNow: Date.now(),
    };
  }

  async playerViewLatest(
    matchId: string,
    playerId: string,
  ): Promise<OnlineBattlePlayerViewV2> {
    const runtime = await this.store.get(matchId);
    const presentationWindow = await this.store.getPresentationWindow(runtime);
    return this.buildPlayerView(runtime, playerId, presentationWindow);
  }

  async playerViewAtEvent(
    matchId: string,
    playerId: string,
    eventSeq: number,
  ): Promise<OnlineBattlePlayerViewV2 | null> {
    const snapshot = await this.loadEventSnapshot(matchId, eventSeq);
    if (!snapshot) return null;
    const runtime: OnlineBattleRuntimeStateV1 = {
      version: 'online_battle_runtime_v1',
      storageRevision: 0,
      clientEventSeq: snapshot.eventSeq,
      match: snapshot.match,
      acceptedPlayerIds: snapshot.acceptedPlayerIds,
      replay: { version: 'battle_replay_accumulator_v1' },
    };
    const view = this.buildPlayerView(
      runtime,
      playerId,
      snapshot.presentationWindow,
    );
    if (view.clientEventSeq !== eventSeq) {
      throw new Error('Battle event view sequence mismatch');
    }
    return view;
  }

  private buildPlayerView(
    runtime: OnlineBattleRuntimeStateV1,
    playerId: string,
    presentationWindow: CompactBattlePresentationWindowV1 | undefined,
  ): OnlineBattlePlayerViewV2 {
    const matchId = runtime.match.matchId;
    if (!runtime.acceptedPlayerIds.includes(playerId)) {
      throw new Error('Player has not accepted the battle');
    }
    const cached = this.projectionCache.get(matchId);
    const projectionKey = `${runtime.match.battle.checkpoint.checkpointRevision}:${runtime.match.planning?.round ?? 'none'}`;
    const projection =
      cached?.projectionKey === projectionKey
        ? cached.projection
        : createBattleMatchViewProjection(runtime.match);
    if (cached?.projectionKey !== projectionKey) {
      this.projectionCache.delete(matchId);
      this.projectionCache.set(matchId, {
        projectionKey,
        projection,
      });
      if (this.projectionCache.size > 128) {
        const oldest = this.projectionCache.keys().next().value;
        if (oldest) this.projectionCache.delete(oldest);
      }
    }
    return buildPlayerView(runtime, playerId, presentationWindow, projection);
  }

  close(): void {
    this.eventSnapshotCache.clear();
    this.resolver.close();
  }

  private loadEventSnapshot(
    matchId: string,
    eventSeq: number,
  ): Promise<OnlineBattleEventSnapshotV1 | null> {
    const key = `${matchId}:${eventSeq}`;
    const cached = this.eventSnapshotCache.get(key);
    if (cached) return cached;
    const loading = this.store.getEventSnapshot(matchId, eventSeq);
    this.eventSnapshotCache.set(key, loading);
    if (this.eventSnapshotCache.size > 256) {
      const oldest = this.eventSnapshotCache.keys().next().value;
      if (oldest) this.eventSnapshotCache.delete(oldest);
    }
    const timer = setTimeout(() => this.eventSnapshotCache.delete(key), 50);
    timer.unref();
    return loading;
  }

  private updateMatch(
    matchId: string,
    update: (
      match: OnlineBattleRuntimeStateV1['match'],
    ) => OnlineBattleRuntimeStateV1['match'],
  ): Promise<boolean> {
    return this.run(matchId, async () => {
      const current = await this.store.get(matchId);
      const match = update(current.match);
      if (match.revision === current.match.revision) return false;
      const next = this.advance(current, { match });
      if (!(await this.compareAndSet(current, next))) return false;
      this.publish(current, next);
      return true;
    });
  }

  private cancelMatch(
    matchId: string,
    reason: Exclude<
      BattleTerminalEventV1['terminalReason'],
      'battle_completed' | 'corrupt_runtime'
    >,
  ): Promise<boolean> {
    return this.run(matchId, async () => {
      const current = await this.store.get(matchId);
      return this.commitCancellation(current, reason, Date.now());
    });
  }

  private async commitCancellation(
    current: OnlineBattleRuntimeStateV1,
    reason: Exclude<
      BattleTerminalEventV1['terminalReason'],
      'battle_completed' | 'corrupt_runtime'
    >,
    now: number,
  ): Promise<boolean> {
    const match = cancelBattleMatch(current.match, now);
    if (match.revision === current.match.revision) return false;
    const next = this.advance(current, {
      match,
      resolutionRetry: undefined,
      termination: { reason, requestedAt: now },
    });
    if (!(await this.compareAndSet(current, next))) return false;
    this.publish(current, next);
    return true;
  }

  private compareAndSet(
    current: OnlineBattleRuntimeStateV1,
    next: OnlineBattleRuntimeStateV1,
    commandReceipt?: OnlineBattleCommandReceiptRecordV1,
  ): Promise<boolean> {
    const eventSnapshot =
      next.clientEventSeq === current.clientEventSeq + 1
        ? createOnlineBattleEventSnapshot(next)
        : undefined;
    return this.store.compareAndSet(
      current,
      next,
      commandReceipt,
      eventSnapshot,
    );
  }

  private publish(
    current: OnlineBattleRuntimeStateV1,
    next: OnlineBattleRuntimeStateV1,
  ): void {
    if (!hasClientVisibleTransition(current, next)) return;
    publishOnlineBattleEvent({
      kind: 'state_changed',
      matchId: next.match.matchId,
      revision: next.match.revision,
      eventSeq: next.clientEventSeq,
    });
  }

  private advance(
    current: OnlineBattleRuntimeStateV1,
    patch: Partial<
      Omit<OnlineBattleRuntimeStateV1, 'version' | 'storageRevision'>
    >,
  ): OnlineBattleRuntimeStateV1 {
    const next = advanceOnlineBattleRuntime(current, patch);
    return hasClientVisibleTransition(current, next)
      ? { ...next, clientEventSeq: current.clientEventSeq + 1 }
      : next;
  }

  private run<T>(matchId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(matchId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.queues.set(matchId, next);
    void next
      .finally(() => {
        if (this.queues.get(matchId) === next) this.queues.delete(matchId);
      })
      .catch(() => undefined);
    return next;
  }
}

function hasClientVisibleTransition(
  current: OnlineBattleRuntimeStateV1,
  next: OnlineBattleRuntimeStateV1,
): boolean {
  if (isNewPresentation(current, next)) return true;
  if (
    next.match.status === 'planning' &&
    (current.match.status !== 'planning' ||
      current.match.planning?.round !== next.match.planning?.round)
  )
    return true;
  if (next.match.status === 'resolving' && current.match.status !== 'resolving')
    return true;
  if (
    (next.match.status === 'finished' ||
      next.match.status === 'cancelled' ||
      next.match.status === 'resolution_failed') &&
    current.match.status !== next.match.status
  )
    return true;
  return Boolean(
    next.match.status === 'planning' &&
    next.match.planning &&
    next.match.planning.committedPlayerIds.length !==
      current.match.planning?.committedPlayerIds.length,
  );
}

function buildPlayerView(
  runtime: OnlineBattleRuntimeStateV1,
  playerId: string,
  presentationWindow: CompactBattlePresentationWindowV1 | undefined,
  projection: ReturnType<typeof createBattleMatchViewProjection>,
): OnlineBattlePlayerViewV2 {
  const playerView = createBattleMatchPlayerView(
    runtime.match,
    playerId,
    Date.now(),
    projection,
  );
  const { latestResolution, ...baseView } = playerView;
  return {
    ...baseView,
    protocolVersion: 2,
    clientEventSeq: runtime.clientEventSeq,
    latestResult: latestResolution
      ? {
          commandSetId: latestResolution.commandSetId,
          round: latestResolution.round,
          outcome: latestResolution.outcome,
        }
      : undefined,
    roundResult: presentationWindow,
  };
}

function assertPlayerSnapshotsFit(
  runtime: OnlineBattleRuntimeStateV1,
  presentationWindow: CompactBattlePresentationWindowV1,
): void {
  const projection = createBattleMatchViewProjection(runtime.match);
  for (const playerId of runtime.acceptedPlayerIds) {
    const encoded = JSON.stringify({
      type: 'battle.snapshot',
      payload: buildPlayerView(
        runtime,
        playerId,
        presentationWindow,
        projection,
      ),
    });
    if (onlineBattleMessageByteLength(encoded) > MAX_SOCKET_MESSAGE_BYTES) {
      throw new OnlineBattleResolutionError(
        `Battle player snapshot exceeds ${MAX_SOCKET_MESSAGE_BYTES} bytes`,
        'deterministic_game_error',
        'PLAYER_SNAPSHOT_TOO_LARGE',
      );
    }
  }
}

function isNewPresentation(
  current: OnlineBattleRuntimeStateV1,
  next: OnlineBattleRuntimeStateV1,
): boolean {
  return (
    next.match.status === 'presenting' &&
    (current.match.status !== 'presenting' ||
      current.match.presentation?.resultId !==
        next.match.presentation?.resultId)
  );
}

function classifyResolutionFailure(error: unknown): {
  kind: 'transient_infrastructure' | 'deterministic_game_error';
  code: string;
  message: string;
} {
  if (error instanceof OnlineBattleResolutionError) {
    return { kind: error.kind, code: error.code, message: error.message };
  }
  return {
    kind: 'deterministic_game_error',
    code:
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'BATTLE_ROUND_RESOLUTION_FAILED',
    message: error instanceof Error ? error.message : String(error),
  };
}

function resolutionFailureFingerprint(failure: {
  code: string;
  message: string;
}): string {
  let hash = 0x811c9dc5;
  const value = `${failure.code}:${failure.message}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `resolution-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function createCommandReceiptRecord(
  playerId: string,
  commandType: OnlineBattleCommandReceiptRecordV1['commandType'],
  payloadHash: string,
  receipt: BattleCommandReceiptV1,
): OnlineBattleCommandReceiptRecordV1 {
  return {
    playerId,
    requestId: receipt.requestId,
    commandType,
    payloadHash,
    receipt,
  };
}

function assertMatchingCommandReceipt(
  prior: OnlineBattleCommandReceiptRecordV1,
  commandType: OnlineBattleCommandReceiptRecordV1['commandType'],
  payloadHash: string,
): void {
  if (prior.commandType !== commandType || prior.payloadHash !== payloadHash) {
    throw new Error(
      'Battle requestId was reused with another command or payload',
    );
  }
}

function commandPayloadHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function createPresentationWindow(
  runtime: OnlineBattleRuntimeStateV1,
  resolution: BattleRoundResolutionV1,
  now: number,
) {
  const publicResolution = {
    version: 'battle_round_resolution_public_v1' as const,
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
  };
  const configs = new Map(
    runtime.match.battle.blueprint.teams.flatMap((team) =>
      team.units.flatMap((unit) =>
        unit.abilityConfigs.map((config) => [config.slug, config] as const),
      ),
    ),
  );
  const plan = createBattleRoundPlaybackPlan(publicResolution, (sequence) => {
    const abilityId =
      sequence.ability?.id ??
      sequence.facts.find((fact) => fact.origin.carrier.kind === 'ability')
        ?.origin.carrier.id;
    return abilityId
      ? resolveBattleAbilityVisual(abilityId, configs.get(abilityId))
      : undefined;
  });
  const compact = compactBattlePresentationWindow(
    createBattlePresentationWindow({
      resultId: `result:${resolution.commandSetId}`,
      startedAt: now,
      startingPublicSnapshot: createBattlePublicSnapshot(runtime.match.battle),
      plan,
    }),
  );
  const payloadBytes = battlePresentationSerializedBytes(compact);
  if (payloadBytes > BATTLE_PRESENTATION_MAX_SERIALIZED_BYTES) {
    throw new OnlineBattleResolutionError(
      `Battle presentation payload exceeds ${BATTLE_PRESENTATION_MAX_SERIALIZED_BYTES} bytes`,
      'deterministic_game_error',
      'PRESENTATION_PAYLOAD_TOO_LARGE',
    );
  }
  return compact;
}

function appendReplayRound(
  runtime: OnlineBattleRuntimeStateV1,
  resolution: BattleRoundResolutionV1,
): OnlineBattleRuntimeStateV1['replay'] {
  const commandSet = runtime.match.resolving!.commandSet;
  const replay = {
    version: 'battle_replay_accumulator_v1',
    pendingRound: {
      round: resolution.round,
      commandSet,
      resolution: toReplayResolution(resolution),
    },
  } satisfies OnlineBattleRuntimeStateV1['replay'];
  const serializedBytes = onlineBattleMessageByteLength(
    JSON.stringify(replay.pendingRound),
  );
  if (serializedBytes > BATTLE_REPLAY_ROUND_MAX_SERIALIZED_BYTES) {
    throw new OnlineBattleResolutionError(
      `Battle replay round exceeds ${BATTLE_REPLAY_ROUND_MAX_SERIALIZED_BYTES} bytes`,
      'deterministic_game_error',
      'REPLAY_ROUND_TOO_LARGE',
    );
  }
  return replay;
}

function toReplayResolution(
  resolution: BattleRoundResolutionV1,
): BattleReplayRoundResolutionV1 {
  return {
    version: 'battle_replay_round_resolution_v1',
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
    stateTimeline: resolution.stateTimeline,
  };
}

function rejectionReason(error: unknown): BattleCommandReceiptV1['reason'] {
  const message = error instanceof Error ? error.message : String(error);
  if (/deadline/.test(message)) return 'deadline_reached';
  if (/Committed player/.test(message)) return 'already_committed';
  if (/checkpoint|round is stale/.test(message)) return 'stale_checkpoint';
  if (/revision/.test(message)) return 'stale_match';
  if (/not planning/.test(message)) return 'match_not_planning';
  return 'invalid_intents';
}
