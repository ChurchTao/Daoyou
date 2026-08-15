import { peekQueuedAction } from '../core/runtimeState';
import {
  restoreBattleSave,
  validateBattleSave,
} from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import { resolveLegalBasicAttack } from '../round/BasicAttackResolver';
import { createBattlePlanningView } from '../round/BattlePlanningView';
import {
  sealRoundCommandSet,
  validateBattleIntents,
} from '../round/BattleRoundResolver';
import { resolveLegalQueuedAction } from '../round/QueuedActionResolver';
import type {
  BattleActionIntentV1,
  BattlePlanningViewV1,
  RoundCommandSetV1,
} from '../round/types';
import { ROUND_PLANNING_TIMEOUT_MS } from '../round/types';
import {
  createBattlePublicSnapshotFromRoster,
  type BattlePublicSnapshotV1,
} from './BattlePublicSnapshot';
import type {
  BattleControllerV1,
  BattleMatchCommandV1,
  BattleMatchPlayerViewV1,
  BattleMatchPresentationV1,
  BattleMatchStateV1,
  BattleMatchTransitionV1,
  BattleResolutionFailureV1,
  BattleRoundResolutionPublicV1,
  ClientBattleIntentV1,
  CreateBattleMatchInput,
  PlayerId,
} from './types';

export function createBattleMatchState(
  input: CreateBattleMatchInput,
): BattleMatchStateV1 {
  validateBattleSave(input.battle);
  validateControllers(input.battle, input.controllers);
  if (!input.matchId || !Number.isFinite(input.now)) {
    throw new Error('Battle match requires an id and finite creation time');
  }
  const timeout = input.planningTimeoutMs ?? ROUND_PLANNING_TIMEOUT_MS;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error('Battle match planning timeout must be positive');
  }
  const state: BattleMatchStateV1 = {
    version: 'battle_match_state_v1',
    matchId: input.matchId,
    status: 'planning',
    revision: 0,
    processedRequestIds: [],
    battle: clone(input.battle),
    controllers: clone(input.controllers),
    planning: {
      round: input.battle.checkpoint.round + 1,
      checkpointRevision: input.battle.checkpoint.checkpointRevision,
      opensAt: input.now,
      deadlineAt: input.now + timeout,
      submissions: {},
      committedPlayerIds: getPlayersWithoutLivingUnits(
        input.battle,
        input.controllers,
      ),
    },
    createdAt: input.now,
    updatedAt: input.now,
  };
  return clone(state);
}

export function holdBattleMatchForPlayers(
  state: BattleMatchStateV1,
): BattleMatchStateV1 {
  if (state.status !== 'planning' || !state.planning) return clone(state);
  return clone({ ...state, status: 'waiting', planning: undefined });
}

export function openBattlePlanning(
  state: BattleMatchStateV1,
  now: number,
): BattleMatchStateV1 {
  if (state.status !== 'waiting') return clone(state);
  return clone({
    ...state,
    status: 'planning',
    planning: {
      round: state.battle.checkpoint.round + 1,
      checkpointRevision: state.battle.checkpoint.checkpointRevision,
      opensAt: now,
      deadlineAt: now + ROUND_PLANNING_TIMEOUT_MS,
      submissions: {},
      committedPlayerIds: getPlayersWithoutLivingUnits(
        state.battle,
        state.controllers,
      ),
    },
    revision: state.revision + 1,
    updatedAt: now,
  });
}

export function transitionBattleMatch(
  state: BattleMatchStateV1,
  command: BattleMatchCommandV1,
  now: number,
): BattleMatchTransitionV1 {
  const current = clone(state);
  if (!command.requestId)
    throw new Error('Battle match command requires requestId');
  if (!Number.isFinite(now))
    throw new Error('Battle match time must be finite');
  if (current.processedRequestIds.includes(command.requestId)) {
    return { state: current, changed: false, duplicateRequest: true };
  }
  if (command.expectedMatchRevision !== current.revision) {
    throw new Error('Battle match revision is stale');
  }
  if (
    command.expectedCheckpointRevision !==
    current.battle.checkpoint.checkpointRevision
  ) {
    throw new Error('Battle checkpoint revision is stale');
  }
  if (command.matchId !== current.matchId) {
    throw new Error('Battle match id does not match state');
  }
  if (current.status !== 'planning' || !current.planning) {
    throw new Error(`Battle match is not planning: ${current.status}`);
  }
  if (
    command.type !== 'resolve_planning_timeout' &&
    now >= current.planning.deadlineAt
  ) {
    throw new Error('Battle planning deadline has been reached');
  }

  if (command.type === 'commit_player_intents') {
    const controller = getController(current, command.playerId);
    if (current.planning.committedPlayerIds.includes(command.playerId)) {
      throw new Error('Committed player cannot change intents');
    }
    const restored = restoreBattleSave(current.battle);
    let livingUnitIds: string[];
    try {
      livingUnitIds = controller.unitIds.filter((unitId) =>
        restored.roster.getUnit(unitId).isAlive(),
      );
    } finally {
      restored.runtime.dispose();
    }
    const submittedUnitIds = Object.keys(command.intents).sort();
    if (
      submittedUnitIds.length !== livingUnitIds.length ||
      submittedUnitIds.some((unitId) => !livingUnitIds.includes(unitId))
    ) {
      throw new Error(
        'Player must commit every living controlled unit exactly once',
      );
    }
    const normalized = Object.fromEntries(
      livingUnitIds.map((unitId) => [
        unitId,
        normalizeClientIntent(command.intents[unitId]),
      ]),
    );
    validateBattleIntents(current.battle, normalized);
    const submissions = {
      ...current.planning.submissions,
      ...normalized,
    };
    const committed = [
      ...current.planning.committedPlayerIds,
      command.playerId,
    ].sort();
    const candidate = {
      ...current,
      planning: {
        ...current.planning,
        submissions,
        committedPlayerIds: committed,
      },
    };
    return transition(
      current,
      {
        planning: candidate.planning,
        updatedAt: now,
      },
      now,
      command.requestId,
    );
  }

  if (now < current.planning.deadlineAt) {
    throw new Error('Battle planning deadline has not been reached');
  }
  const committedPlayerIds = current.controllers.map(
    (controller) => controller.playerId,
  );
  const submissions = completeMissingIntentsAtDeadline(current);
  return transition(
    current,
    {
      planning: { ...current.planning, submissions, committedPlayerIds },
      updatedAt: now,
    },
    now,
    command.requestId,
  );
}

export function applyBattleRoundResolution(
  state: BattleMatchStateV1,
  resolution: import('../round/types').BattleRoundResolutionV1,
  now: number,
  presentation: Omit<BattleMatchPresentationV1, 'round' | 'readyPlayerIds'>,
): BattleMatchStateV1 {
  if (state.status !== 'resolving' || !state.resolving) {
    throw new Error('Battle match is not resolving');
  }
  if (state.resolving.commandSet.commandSetId !== resolution.commandSetId) {
    throw new Error('Resolution does not match the sealed command set');
  }
  validatePresentationTiming(presentation, now);
  return clone({
    ...state,
    status: 'presenting',
    planning: undefined,
    resolving: undefined,
    presentation: {
      ...presentation,
      round: resolution.round,
      readyPlayerIds: [],
    },
    battle: resolution.save,
    latestResolution: toPublicResolution(resolution),
    revision: state.revision + 1,
    updatedAt: now,
  });
}

export function markBattlePresentationReady(
  state: BattleMatchStateV1,
  playerId: PlayerId,
  resultId: string,
  now: number,
): BattleMatchStateV1 {
  // Ready is an informational acknowledgement from the client. The
  // authoritative presentation boundary remains scheduledEndsAt and is
  // enforced by completeBattlePresentation below.
  if (state.status !== 'presenting' || !state.presentation) {
    throw new Error('Battle match is not presenting');
  }
  getController(state, playerId);
  if (state.presentation.resultId !== resultId) {
    throw new Error('Battle presentation result is stale');
  }
  if (state.presentation.readyPlayerIds.includes(playerId)) return clone(state);
  const readyPlayerIds = [...state.presentation.readyPlayerIds, playerId].sort();
  const next = clone({
    ...state,
    presentation: { ...state.presentation, readyPlayerIds },
    revision: state.revision + 1,
    updatedAt: now,
  });
  return next;
}

export function completeBattlePresentation(
  state: BattleMatchStateV1,
  now: number,
): BattleMatchStateV1 {
  if (state.status !== 'presenting' || !state.presentation) return clone(state);
  // Never let an early client Ready acknowledgement shorten the animation
  // window; only the authoritative scheduled end may advance the match.
  if (now < state.presentation.scheduledEndsAt) {
    return clone(state);
  }
  const finished = Boolean(state.latestResolution?.outcome.battleEnded);
  return clone({
    ...state,
    status: finished ? 'finished' : 'planning',
    presentation: undefined,
    planning: finished
      ? undefined
      : {
          round: state.battle.checkpoint.round + 1,
          checkpointRevision: state.battle.checkpoint.checkpointRevision,
          opensAt: now,
          deadlineAt: now + ROUND_PLANNING_TIMEOUT_MS,
          submissions: {},
          committedPlayerIds: getPlayersWithoutLivingUnits(
            state.battle,
            state.controllers,
          ),
        },
    revision: state.revision + 1,
    updatedAt: now,
  });
}

function validatePresentationTiming(
  presentation: Omit<BattleMatchPresentationV1, 'round' | 'readyPlayerIds'>,
  now: number,
): void {
  if (
    !presentation.resultId ||
    presentation.startedAt !== now ||
    presentation.readyAcceptedAt < presentation.startedAt ||
    presentation.scheduledEndsAt < presentation.readyAcceptedAt
  ) {
    throw new Error('Battle presentation timing is invalid');
  }
}

export function markBattleResolutionFailed(
  state: BattleMatchStateV1,
  error: unknown,
  now: number,
): BattleMatchStateV1 {
  if (state.status !== 'resolving' || !state.resolving) return clone(state);
  const failure = createBattleResolutionFailure(error, now);
  return clone({
    ...state,
    status: 'resolution_failed',
    resolving: { ...state.resolving, failure },
    revision: state.revision + 1,
    updatedAt: now,
  });
}

export function retryFailedBattleResolution(
  state: BattleMatchStateV1,
  now: number,
): BattleMatchStateV1 {
  if (state.status !== 'resolution_failed' || !state.resolving)
    return clone(state);
  return clone({
    ...state,
    status: 'resolving',
    resolving: { commandSet: state.resolving.commandSet, startedAt: now },
    revision: state.revision + 1,
    updatedAt: now,
  });
}

export function cancelBattleMatch(
  state: BattleMatchStateV1,
  now: number,
): BattleMatchStateV1 {
  if (state.status === 'finished' || state.status === 'cancelled') {
    return clone(state);
  }
  return clone({
    ...state,
    status: 'cancelled',
    planning: undefined,
    resolving: undefined,
    presentation: undefined,
    revision: state.revision + 1,
    updatedAt: now,
  });
}

function createBattleResolutionFailure(
  error: unknown,
  failedAt: number,
): BattleResolutionFailureV1 {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'BATTLE_RESOLUTION_LIMIT_EXCEEDED'
      ? ('BATTLE_RESOLUTION_LIMIT_EXCEEDED' as const)
      : ('BATTLE_ROUND_RESOLUTION_FAILED' as const);
  return {
    code,
    fingerprint: stableErrorFingerprint(
      `${error instanceof Error ? error.name : 'Error'}:${message}`,
    ),
    message,
    failedAt,
  };
}

function stableErrorFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `resolution-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createBattleMatchPlayerView(
  state: BattleMatchStateV1,
  playerId: PlayerId,
  now: number,
  projection = createBattleMatchViewProjection(state),
): BattleMatchPlayerViewV1 {
  const controller = getController(state, playerId);
  const planning = state.planning;
  return clone({
    version: 'battle_match_player_view_v1',
    matchId: state.matchId,
    status: state.status,
    revision: state.revision,
    playerId,
    teamId: controller.teamId,
    controlledUnitIds: controller.unitIds,
    round:
      planning?.round ??
      state.resolving?.commandSet.round ??
      state.battle.checkpoint.round,
    checkpointRevision:
      planning?.checkpointRevision ??
      state.resolving?.commandSet.checkpointRevision ??
      state.battle.checkpoint.checkpointRevision,
    deadlineAt: planning?.deadlineAt,
    planningOpensAt: planning?.opensAt,
    serverNow: now,
    publicSnapshot: projection.publicSnapshot,
    planningView: projection.planningViewByPlayerId[playerId],
    ownSubmissions: Object.fromEntries(
      controller.unitIds
        .filter((unitId) => planning?.submissions[unitId])
        .map((unitId) => [unitId, planning!.submissions[unitId]]),
    ),
    ownCommitted: planning?.committedPlayerIds.includes(playerId) ?? false,
    latestResolution: state.latestResolution,
    presentation: state.presentation,
    resolutionFailure: state.resolving?.failure
      ? {
          code: state.resolving.failure.code,
          fingerprint: state.resolving.failure.fingerprint,
          failedAt: state.resolving.failure.failedAt,
        }
      : undefined,
  });
}

export interface BattleMatchViewProjection {
  readonly publicSnapshot: BattlePublicSnapshotV1;
  readonly planningViewByPlayerId: Readonly<
    Record<PlayerId, BattlePlanningViewV1>
  >;
}

export function createBattleMatchViewProjection(
  state: BattleMatchStateV1,
): BattleMatchViewProjection {
  const restored = restoreBattleSave(state.battle);
  try {
    const planningViewByPlayerId: Record<PlayerId, BattlePlanningViewV1> = {};
    if (state.planning) {
      for (const controller of state.controllers) {
        planningViewByPlayerId[controller.playerId] = createBattlePlanningView({
          roster: restored.roster,
          round: state.planning.round,
          checkpointRevision: state.planning.checkpointRevision,
          unitIds: controller.unitIds,
        });
      }
    }
    return {
      publicSnapshot: createBattlePublicSnapshotFromRoster(
        state.battle,
        restored.roster,
      ),
      planningViewByPlayerId,
    };
  } finally {
    restored.runtime.dispose();
  }
}

function toPublicResolution(
  resolution: import('../round/types').BattleRoundResolutionV1,
): BattleRoundResolutionPublicV1 {
  return {
    version: 'battle_round_resolution_public_v1',
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
  };
}

function transition(
  state: BattleMatchStateV1,
  patch: Partial<BattleMatchStateV1>,
  now: number,
  requestId: string,
): BattleMatchTransitionV1 {
  let next = clone({
    ...state,
    ...patch,
    processedRequestIds: [...state.processedRequestIds, requestId].slice(-128),
    revision: state.revision + 1,
    updatedAt: now,
  });
  const planning = next.planning;
  if (planning && allControllersCommitted(next)) {
    const commandSet = buildCompleteCommandSet(next);
    const sealed = sealRoundCommandSet(next.battle, commandSet);
    next = clone({
      ...next,
      status: 'resolving',
      planning: undefined,
      resolving: { commandSet: sealed, startedAt: now },
      revision: next.revision + 1,
    });
    return { state: next, changed: true, duplicateRequest: false };
  }
  return { state: next, changed: true, duplicateRequest: false };
}

function buildCompleteCommandSet(state: BattleMatchStateV1): RoundCommandSetV1 {
  return {
    version: 'round_command_set_v1',
    commandSetId: `${state.matchId}:${state.planning!.round}:${state.planning!.checkpointRevision}`,
    round: state.planning!.round,
    checkpointRevision: state.planning!.checkpointRevision,
    intents: { ...state.planning!.submissions },
  };
}

/** Completes only genuinely missing actions after the trusted deadline fires. */
function completeMissingIntentsAtDeadline(
  state: BattleMatchStateV1,
): Record<string, BattleActionIntentV1> {
  const restored = restoreBattleSave(state.battle);
  try {
    const result: Record<string, BattleActionIntentV1> = {
      ...state.planning!.submissions,
    };
    const allUnits = restored.roster.getAllUnits();
    for (const unit of restored.roster.getLivingUnits()) {
      if (result[unit.id]) continue;
      const queued = peekQueuedAction(unit);
      const target = queued
        ? resolveLegalQueuedAction(unit, allUnits)?.target
        : resolveLegalBasicAttack(unit, allUnits)?.target;
      result[unit.id] = target
        ? {
            kind: 'basic_attack',
            targetUnitId: target.id,
            submittedBy: 'timeout',
          }
        : { kind: 'skip', submittedBy: 'timeout' };
    }
    return result;
  } finally {
    restored.runtime.dispose();
  }
}

function allControllersCommitted(state: BattleMatchStateV1): boolean {
  const playersRequiringCommit = getPlayersWithLivingUnits(
    state.battle,
    state.controllers,
  );
  return playersRequiringCommit.every((playerId) =>
    state.planning!.committedPlayerIds.includes(playerId),
  );
}

function getPlayersWithoutLivingUnits(
  battle: BattleSaveV1,
  controllers: readonly BattleControllerV1[],
): PlayerId[] {
  const livingPlayers = new Set(getPlayersWithLivingUnits(battle, controllers));
  return controllers
    .map((controller) => controller.playerId)
    .filter((playerId) => !livingPlayers.has(playerId));
}

function getPlayersWithLivingUnits(
  battle: BattleSaveV1,
  controllers: readonly BattleControllerV1[],
): PlayerId[] {
  const restored = restoreBattleSave(battle);
  try {
    return controllers
      .filter((controller) =>
        controller.unitIds.some((unitId) =>
          restored.roster.getUnit(unitId).isAlive(),
        ),
      )
      .map((controller) => controller.playerId);
  } finally {
    restored.runtime.dispose();
  }
}

function getController(
  state: BattleMatchStateV1,
  playerId: string,
): BattleControllerV1 {
  const controller = state.controllers.find(
    (entry) => entry.playerId === playerId,
  );
  if (!controller) throw new Error('Player is not a battle controller');
  return controller;
}

function normalizeClientIntent(
  intent: ClientBattleIntentV1,
): BattleActionIntentV1 {
  if (intent.kind === 'basic_attack' && intent.targetUnitId) {
    return {
      kind: 'basic_attack',
      targetUnitId: intent.targetUnitId,
      submittedBy: 'player',
    };
  }
  if (intent.kind !== 'ability' || !intent.abilityId)
    throw new Error('Invalid ability intent');
  return {
    kind: 'ability',
    abilityId: intent.abilityId,
    ...(intent.targetUnitId ? { targetUnitId: intent.targetUnitId } : {}),
    submittedBy: 'player',
  };
}

function validateControllers(
  save: BattleSaveV1,
  controllers: readonly BattleControllerV1[],
): void {
  if (
    controllers.length < 2 ||
    new Set(controllers.map((entry) => entry.playerId)).size !==
      controllers.length
  ) {
    throw new Error('Battle match requires at least two unique controllers');
  }
  const units = new Set(Object.keys(save.checkpoint.units));
  const controlled = new Set<string>();
  for (const controller of controllers) {
    if (
      !controller.playerId ||
      !controller.teamId ||
      controller.unitIds.length < 1
    )
      throw new Error('Invalid battle controller');
    if (!save.blueprint.teams.some((team) => team.id === controller.teamId))
      throw new Error('Controller references unknown team');
    for (const unitId of controller.unitIds) {
      if (!units.has(unitId) || controlled.has(unitId))
        throw new Error('Controller references invalid or duplicate unit');
      controlled.add(unitId);
      const team = save.blueprint.teams.find((entry) =>
        entry.units.some((unit) => unit.id === unitId),
      );
      if (team?.id !== controller.teamId)
        throw new Error('Controller unit is not on the declared team');
    }
  }
  if (controlled.size !== units.size)
    throw new Error('Every battle unit must have a controller');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
