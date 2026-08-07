import { ROUND_PLANNING_TIMEOUT_MS } from '../round/types';
import { sealRoundCommandSet } from '../round/BattleRoundResolver';
import type { BattleActionIntentV1, RoundCommandSetV1 } from '../round/types';
import type { BattleSaveV1 } from '../persistence/types';
import type {
  BattleControllerV1,
  BattleMatchCommandV1,
  BattleMatchPlayerViewV1,
  BattleMatchStateV1,
  BattleMatchTransitionV1,
  BattleRoundResolutionPublicV1,
  ClientBattleIntentV1,
  CreateBattleMatchInput,
  PlayerId,
} from './types';
import { createBattlePlanningView } from '../round/BattlePlanningView';
import {
  restoreBattleSave,
  validateBattleSave,
} from '../persistence/BattleStateCodec';
import { createBattlePublicSnapshot } from './BattlePublicSnapshot';

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
      deadlineAt: input.now + timeout,
      submissions: {},
      lockedPlayerIds: [],
    },
    createdAt: input.now,
    updatedAt: input.now,
  };
  return clone(state);
}

export function transitionBattleMatch(
  state: BattleMatchStateV1,
  command: BattleMatchCommandV1,
  now: number,
): BattleMatchTransitionV1 {
  const current = clone(state);
  if (!command.requestId) throw new Error('Battle match command requires requestId');
  if (!Number.isFinite(now)) throw new Error('Battle match time must be finite');
  if (current.processedRequestIds.includes(command.requestId)) {
    return { state: current, effects: [], changed: false, duplicateRequest: true };
  }
  if (command.expectedMatchRevision !== current.revision) {
    throw new Error('Battle match revision is stale');
  }
  if (
    command.expectedCheckpointRevision !== current.battle.checkpoint.checkpointRevision
  ) {
    throw new Error('Battle checkpoint revision is stale');
  }
  if (command.matchId !== current.matchId) {
    throw new Error('Battle match id does not match state');
  }
  if (current.status !== 'planning' || !current.planning) {
    throw new Error(`Battle match is not planning: ${current.status}`);
  }
  if (command.type !== 'resolve_planning_timeout' && now >= current.planning.deadlineAt) {
    throw new Error('Battle planning deadline has been reached');
  }

  if (command.type === 'submit_unit_intent') {
    const controller = getController(current, command.playerId);
    if (current.planning.lockedPlayerIds.includes(command.playerId)) {
      throw new Error('Locked player cannot change intents');
    }
    if (!controller.unitIds.includes(command.unitId)) {
      throw new Error('Player does not control this unit');
    }
    const intent = normalizeClientIntent(command.intent);
    const restored = restoreBattleSave(current.battle);
    try {
      const unit = restored.roster.getUnit(command.unitId);
      if (!unit.isAlive()) throw new Error('Dead unit cannot submit an intent');
    } finally {
      restored.runtime.dispose();
    }
    const submissions = {
      ...current.planning.submissions,
      [command.unitId]: intent,
    };
    return transition(current, {
      planning: { ...current.planning, submissions },
      updatedAt: now,
    }, now, command.requestId);
  }

  if (command.type === 'lock_player') {
    const controller = getController(current, command.playerId);
    const restored = restoreBattleSave(current.battle);
    try {
      const missingUnitIds = controller.unitIds.filter((unitId) => {
        const unit = restored.roster.getUnit(unitId);
        return unit.isAlive() && !current.planning!.submissions[unitId];
      });
      if (missingUnitIds.length > 0) {
        throw new Error(
          `Player must submit every living unit intent before locking: ${missingUnitIds.join(',')}`,
        );
      }
    } finally {
      restored.runtime.dispose();
    }
    const locked = new Set(current.planning.lockedPlayerIds);
    locked.add(controller.playerId);
    return transition(current, {
      planning: { ...current.planning, lockedPlayerIds: [...locked].sort() },
      updatedAt: now,
    }, now, command.requestId);
  }

  if (now < current.planning.deadlineAt) {
    throw new Error('Battle planning deadline has not been reached');
  }
  const lockedPlayerIds = current.controllers.map((controller) => controller.playerId);
  const submissions = fillTimeouts(current);
  return transition(current, {
    planning: { ...current.planning, submissions, lockedPlayerIds },
    updatedAt: now,
  }, now, command.requestId);
}

export function applyBattleRoundResolution(
  state: BattleMatchStateV1,
  resolution: import('../round/types').BattleRoundResolutionV1,
  now: number,
): BattleMatchStateV1 {
  if (state.status !== 'resolving' || !state.resolving) {
    throw new Error('Battle match is not resolving');
  }
  if (state.resolving.commandSet.commandSetId !== resolution.commandSetId) {
    throw new Error('Resolution does not match the sealed command set');
  }
  const next = resolution.outcome.battleEnded
    ? { status: 'finished' as const, planning: undefined, resolving: undefined }
    : {
        status: 'planning' as const,
        planning: {
          round: resolution.checkpoint.round + 1,
          checkpointRevision: resolution.checkpoint.checkpointRevision,
          deadlineAt: now + ROUND_PLANNING_TIMEOUT_MS,
          submissions: {},
          lockedPlayerIds: [],
        },
        resolving: undefined,
      };
  return clone({
    ...state,
    ...next,
    battle: resolution.save,
    latestResolution: resolution,
    revision: state.revision + 1,
    updatedAt: now,
  });
}

export function createBattleMatchPlayerView(
  state: BattleMatchStateV1,
  playerId: PlayerId,
  now: number,
): BattleMatchPlayerViewV1 {
  const controller = getController(state, playerId);
  const planning = state.planning;
  let planningView;
  if (planning) {
    const restored = restoreBattleSave(state.battle);
    try {
      planningView = createBattlePlanningView({
        roster: restored.roster,
        round: planning.round,
        checkpointRevision: planning.checkpointRevision,
        teamId: controller.teamId,
      });
    } finally {
      restored.runtime.dispose();
    }
  }
  return clone({
    version: 'battle_match_player_view_v1',
    matchId: state.matchId,
    status: state.status,
    revision: state.revision,
    playerId,
    teamId: controller.teamId,
    controlledUnitIds: controller.unitIds,
    round: planning?.round ?? state.battle.checkpoint.round,
    checkpointRevision:
      planning?.checkpointRevision ?? state.battle.checkpoint.checkpointRevision,
    deadlineAt: planning?.deadlineAt,
    serverNow: now,
    publicSnapshot: createBattlePublicSnapshot(state.battle),
    planningView,
    ownSubmissions: Object.fromEntries(
      controller.unitIds
        .filter((unitId) => planning?.submissions[unitId])
        .map((unitId) => [unitId, planning!.submissions[unitId]]),
    ),
    lockedPlayerIds: planning?.lockedPlayerIds ?? [],
    latestResolution: state.latestResolution
      ? toPublicResolution(state.latestResolution)
      : undefined,
  });
}

function toPublicResolution(
  resolution: import('../round/types').BattleRoundResolutionV1,
): BattleRoundResolutionPublicV1 {
  return {
    version: 'battle_round_resolution_public_v1',
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
    stateTimeline: resolution.stateTimeline,
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
    processedRequestIds: [...state.processedRequestIds, requestId],
    revision: state.revision + 1,
    updatedAt: now,
  });
  const planning = next.planning;
  if (planning && allControllersLocked(next)) {
    const commandSet = buildCommandSet(next);
    const sealed = sealRoundCommandSet(next.battle, commandSet);
    next = clone({
      ...next,
      status: 'resolving',
      planning: undefined,
      resolving: { commandSet: sealed, startedAt: now },
      revision: next.revision + 1,
    });
    return { state: next, effects: [{ type: 'resolve_round', commandSet: sealed }], changed: true, duplicateRequest: false };
  }
  return { state: next, effects: [], changed: true, duplicateRequest: false };
}

function buildCommandSet(state: BattleMatchStateV1): RoundCommandSetV1 {
  const submissions = fillTimeouts(state);
  return {
    version: 'round_command_set_v1',
    commandSetId: `${state.matchId}:${state.planning!.round}:${state.planning!.checkpointRevision}`,
    round: state.planning!.round,
    checkpointRevision: state.planning!.checkpointRevision,
    intents: submissions,
  };
}

function fillTimeouts(state: BattleMatchStateV1): Record<string, BattleActionIntentV1> {
  const restored = restoreBattleSave(state.battle);
  try {
    const result: Record<string, BattleActionIntentV1> = { ...state.planning!.submissions };
    for (const unit of restored.roster.getLivingUnits()) {
      if (!result[unit.id]) result[unit.id] = { kind: 'pass', submittedBy: 'timeout' };
    }
    return result;
  } finally {
    restored.runtime.dispose();
  }
}

function allControllersLocked(state: BattleMatchStateV1): boolean {
  return state.controllers.every((controller) =>
    state.planning!.lockedPlayerIds.includes(controller.playerId),
  );
}

function getController(state: BattleMatchStateV1, playerId: string): BattleControllerV1 {
  const controller = state.controllers.find((entry) => entry.playerId === playerId);
  if (!controller) throw new Error('Player is not a battle controller');
  return controller;
}

function normalizeClientIntent(intent: ClientBattleIntentV1): BattleActionIntentV1 {
  if (intent.kind === 'pass') return { kind: 'pass', submittedBy: 'player' };
  if (intent.kind !== 'ability' || !intent.abilityId) throw new Error('Invalid ability intent');
  return {
    kind: 'ability',
    abilityId: intent.abilityId,
    ...(intent.targetUnitId ? { targetUnitId: intent.targetUnitId } : {}),
    submittedBy: 'player',
  };
}

function validateControllers(save: BattleSaveV1, controllers: readonly BattleControllerV1[]): void {
  if (controllers.length < 2 || new Set(controllers.map((entry) => entry.playerId)).size !== controllers.length) {
    throw new Error('Battle match requires at least two unique controllers');
  }
  const units = new Set(Object.keys(save.checkpoint.units));
  const controlled = new Set<string>();
  for (const controller of controllers) {
    if (!controller.playerId || !controller.teamId || controller.unitIds.length < 1) throw new Error('Invalid battle controller');
    if (!save.blueprint.teams.some((team) => team.id === controller.teamId)) throw new Error('Controller references unknown team');
    for (const unitId of controller.unitIds) {
      if (!units.has(unitId) || controlled.has(unitId)) throw new Error('Controller references invalid or duplicate unit');
      controlled.add(unitId);
      const team = save.blueprint.teams.find((entry) => entry.units.some((unit) => unit.id === unitId));
      if (team?.id !== controller.teamId) throw new Error('Controller unit is not on the declared team');
    }
  }
  if (controlled.size !== units.size) throw new Error('Every battle unit must have a controller');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
