import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import { AttributeType } from '../core/types';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '../persistence/BattleStateCodec';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import {
  applyBattleRoundResolution,
  createBattleMatchPlayerView,
  createBattleMatchState,
  transitionBattleMatch,
} from './BattleMatchStateMachine';
import { BattleMatchCoordinator } from './BattleMatchCoordinator';
import type { BattleSaveV1 } from '../persistence/types';
import type { BattleControllerV1, BattleMatchStateV1 } from './types';

function save(): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const units = [
    new Unit('a0', 'a0', { [AttributeType.SPEED]: 10 }, { runtime, teamId: 'a', slot: 0 }),
    new Unit('a1', 'a1', {}, { runtime, teamId: 'a', slot: 1 }),
    new Unit('b0', 'b0', {}, { runtime, teamId: 'b', slot: 0 }),
    new Unit('b1', 'b1', {}, { runtime, teamId: 'b', slot: 1 }),
  ];
  const roster = new BattleRoster(units);
  const blueprint = createBattleBlueprint('match-test', roster);
  return {
    version: 'battle_save_v1',
    blueprint,
    checkpoint: captureBattleCheckpoint({
      blueprint,
      roster,
      runtime,
      round: 0,
      checkpointRevision: 0,
    }),
  };
}

const controllers: BattleControllerV1[] = [
  { playerId: 'p-a', teamId: 'a', unitIds: ['a0', 'a1'] },
  { playerId: 'p-b', teamId: 'b', unitIds: ['b0', 'b1'] },
];

function commandBase(state: BattleMatchStateV1, requestId: string) {
  return {
    requestId,
    expectedMatchRevision: state.revision,
    expectedCheckpointRevision: state.battle.checkpoint.checkpointRevision,
  };
}

describe('BattleMatchStateMachine', () => {
  it('accepts owned intents and seals only after every controller locks', () => {
    let state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });

    let transition = transitionBattleMatch(state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(state, 'intent-a0'),
      playerId: 'p-a',
      unitId: 'a0',
      intent: { kind: 'pass' },
    }, 1_001);
    state = transition.state;
    expect(state.status).toBe('planning');

    transition = transitionBattleMatch(state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(state, 'intent-a1'),
      playerId: 'p-a',
      unitId: 'a1',
      intent: { kind: 'pass' },
    }, 1_002);
    state = transition.state;

    transition = transitionBattleMatch(state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(state, 'intent-b0'),
      playerId: 'p-b',
      unitId: 'b0',
      intent: { kind: 'pass' },
    }, 1_003);
    state = transition.state;

    transition = transitionBattleMatch(state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(state, 'intent-b1'),
      playerId: 'p-b',
      unitId: 'b1',
      intent: { kind: 'pass' },
    }, 1_004);
    state = transition.state;

    transition = transitionBattleMatch(state, {
      type: 'lock_player',
      matchId: 'match-test',
      ...commandBase(state, 'lock-a'),
      playerId: 'p-a',
    }, 1_005);
    state = transition.state;
    expect(state.status).toBe('planning');

    transition = transitionBattleMatch(state, {
      type: 'lock_player',
      matchId: 'match-test',
      ...commandBase(state, 'lock-b'),
      playerId: 'p-b',
    }, 1_006);
    expect(transition.state.status).toBe('resolving');
    expect(transition.effects[0]?.type).toBe('resolve_round');
    expect(Object.values(transition.state.resolving!.commandSet.intents)).toHaveLength(4);
    expect(
      Object.values(transition.state.resolving!.commandSet.intents).every(
        (intent) => intent.submittedBy === 'player',
      ),
    ).toBe(true);
  });

  it('requires every living controlled unit intent before a manual lock', () => {
    const state = createBattleMatchState({ matchId: 'match-test', battle: save(), controllers, now: 1_000 });
    expect(() => transitionBattleMatch(state, {
      type: 'lock_player',
      matchId: 'match-test',
      ...commandBase(state, 'lock-incomplete'),
      playerId: 'p-a',
    }, 1_001)).toThrow('every living unit intent');
  });

  it('rejects cross-player intents and supports request idempotency', () => {
    const state = createBattleMatchState({ matchId: 'match-test', battle: save(), controllers, now: 1_000 });
    expect(() => transitionBattleMatch(state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(state, 'bad'),
      playerId: 'p-a',
      unitId: 'b0',
      intent: { kind: 'pass' },
    }, 1_001)).toThrow('does not control');

    const accepted = transitionBattleMatch(state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(state, 'same'),
      playerId: 'p-a',
      unitId: 'a0',
      intent: { kind: 'pass' },
    }, 1_001);
    const duplicate = transitionBattleMatch(accepted.state, {
      type: 'submit_unit_intent',
      matchId: 'match-test',
      ...commandBase(accepted.state, 'same'),
      playerId: 'p-a',
      unitId: 'a0',
      intent: { kind: 'ability', abilityId: 'invalid' },
    }, 1_002);
    expect(duplicate.duplicateRequest).toBe(true);
    expect(duplicate.state).toEqual(accepted.state);
  });

  it('resolves all missing intents at deadline and exposes only own submissions', () => {
    const state = createBattleMatchState({ matchId: 'match-test', battle: save(), controllers, now: 1_000 });
    const result = transitionBattleMatch(state, {
      type: 'resolve_planning_timeout',
      matchId: 'match-test',
      ...commandBase(state, 'timeout'),
    }, 31_000);
    expect(result.state.status).toBe('resolving');
    expect(Object.values(result.state.resolving!.commandSet.intents)).toHaveLength(4);

    const view = createBattleMatchPlayerView(state, 'p-a', 1_500);
    expect(view.planningView?.units).toHaveLength(2);
    expect(view.publicSnapshot.units).toHaveLength(4);
    expect(view.publicSnapshot.version).toBe('battle_public_snapshot_v1');
    expect(view.ownSubmissions).toEqual({});
    expect(JSON.stringify(view)).toContain('b0');
    expect(JSON.stringify(view)).not.toContain('battle_save_v1');
  });

  it('returns to planning after applying a non-terminal resolution', () => {
    let state = createBattleMatchState({ matchId: 'match-test', battle: save(), controllers, now: 1_000 });
    const transition = transitionBattleMatch(state, {
      type: 'resolve_planning_timeout',
      matchId: 'match-test',
      ...commandBase(state, 'timeout'),
    }, 31_000);
    state = transition.state;
    const resolution = {
      version: 'battle_round_resolution_v1' as const,
      commandSetId: state.resolving!.commandSet.commandSetId,
      round: 1,
      outcome: { battleEnded: false },
      sequences: [],
      stateTimeline: { version: 'battle_state_timeline_v3' as const, frames: [] },
      checkpoint: { ...state.battle.checkpoint, round: 1, checkpointRevision: 1 },
      save: { ...state.battle, checkpoint: { ...state.battle.checkpoint, round: 1, checkpointRevision: 1 } },
    };
    const next = applyBattleRoundResolution(state, resolution, 32_000);
    expect(next.status).toBe('planning');
    expect(next.planning?.round).toBe(2);
    const view = createBattleMatchPlayerView(next, 'p-a', 32_001);
    expect(view.latestResolution?.version).toBe('battle_round_resolution_public_v1');
    expect(JSON.stringify(view.latestResolution)).not.toContain('battle_save_v1');
  });

  it('persists resolving before executing and can resume after a retry', async () => {
    let stored = createBattleMatchState({ matchId: 'match-test', battle: save(), controllers, now: 1_000 });
    const repository = {
      async load() { return stored; },
      async save(next: BattleMatchStateV1, expectedRevision: number) {
        if (stored.revision !== expectedRevision) return false;
        stored = next;
        return true;
      },
    };
    const coordinator = new BattleMatchCoordinator({
      repository,
      lock: { runExclusive: async (_matchId, operation) => operation() },
      now: () => 31_000,
    });
    const result = await coordinator.dispatch({
      type: 'resolve_planning_timeout',
      matchId: 'match-test',
      requestId: 'timeout',
      expectedMatchRevision: stored.revision,
      expectedCheckpointRevision: stored.battle.checkpoint.checkpointRevision,
    });
    expect(result.status).toBe('planning');
    expect(stored.battle.checkpoint.checkpointRevision).toBe(1);
  });
});
