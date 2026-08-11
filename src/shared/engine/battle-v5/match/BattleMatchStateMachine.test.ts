import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleResolutionError } from '../core/BattleResolutionError';
import { BattleRoster } from '../core/BattleRoster';
import { setQueuedAction } from '../core/runtimeState';
import { AbilityType, AttributeType, DamageType } from '../core/types';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import {
  applyBattleRoundResolution,
  cancelBattleResolution,
  createBattleMatchPlayerView,
  createBattleMatchState,
  markBattleResolutionFailed,
  retryFailedBattleResolution,
  transitionBattleMatch,
} from './BattleMatchStateMachine';
import type { BattleControllerV1, BattleMatchStateV1 } from './types';

function save(options: { queuedUnitId?: string } = {}): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const units = [
    new Unit(
      'a0',
      'a0',
      { [AttributeType.SPEED]: 10 },
      { runtime, teamId: 'a', slot: 0 },
    ),
    new Unit('a1', 'a1', {}, { runtime, teamId: 'a', slot: 1 }),
    new Unit('b0', 'b0', {}, { runtime, teamId: 'b', slot: 0 }),
    new Unit('b1', 'b1', {}, { runtime, teamId: 'b', slot: 1 }),
  ];
  const queuedUnit = units.find((unit) => unit.id === options.queuedUnitId);
  if (queuedUnit) {
    setQueuedAction(
      queuedUnit,
      {
        slug: 'queued-strike',
        name: '蓄势一击',
        type: AbilityType.ACTIVE_SKILL,
        tags: [
          GameplayTags.ABILITY.KIND.SKILL,
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.TRUE,
        ],
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: { base: 10, coefficient: 0 },
              damageType: DamageType.TRUE,
              canCrit: false,
            },
          },
        ],
      },
      { interruptPolicy: 'uninterruptible', hitPolicy: 'guaranteed' },
    );
  }
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

function basicIntents(playerId: 'p-a' | 'p-b') {
  const unitIds = playerId === 'p-a' ? ['a0', 'a1'] : ['b0', 'b1'];
  const targetUnitId = playerId === 'p-a' ? 'b0' : 'a0';
  return Object.fromEntries(
    unitIds.map((unitId) => [
      unitId,
      { kind: 'basic_attack' as const, targetUnitId },
    ]),
  );
}

describe('BattleMatchStateMachine', () => {
  it('commits one atomic player command set and seals immediately after everyone commits', () => {
    let state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });

    let transition = transitionBattleMatch(
      state,
      {
        type: 'commit_player_intents',
        matchId: 'match-test',
        ...commandBase(state, 'commit-a'),
        playerId: 'p-a',
        intents: basicIntents('p-a'),
      },
      1_001,
    );
    state = transition.state;
    expect(state.status).toBe('planning');
    expect(state.planning?.committedPlayerIds).toEqual(['p-a']);

    transition = transitionBattleMatch(
      state,
      {
        type: 'commit_player_intents',
        matchId: 'match-test',
        ...commandBase(state, 'commit-b'),
        playerId: 'p-b',
        intents: basicIntents('p-b'),
      },
      1_002,
    );
    expect(transition.state.status).toBe('resolving');
    expect(
      Object.values(transition.state.resolving!.commandSet.intents),
    ).toHaveLength(4);
    expect(
      Object.values(transition.state.resolving!.commandSet.intents).every(
        (intent) => intent.submittedBy === 'player',
      ),
    ).toBe(true);
  });

  it('requires every living controlled unit exactly once in an atomic commit', () => {
    const state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    expect(() =>
      transitionBattleMatch(
        state,
        {
          type: 'commit_player_intents',
          matchId: 'match-test',
          ...commandBase(state, 'commit-incomplete'),
          playerId: 'p-a',
          intents: { a0: { kind: 'basic_attack', targetUnitId: 'b0' } },
        },
        1_001,
      ),
    ).toThrow('every living controlled unit exactly once');
  });

  it('validates only the submitting player and seals queued actions regardless of commit order', () => {
    let state = createBattleMatchState({
      matchId: 'match-test',
      battle: save({ queuedUnitId: 'a0' }),
      controllers,
      now: 1_000,
    });

    state = transitionBattleMatch(
      state,
      {
        type: 'commit_player_intents',
        matchId: 'match-test',
        ...commandBase(state, 'commit-b-first'),
        playerId: 'p-b',
        intents: basicIntents('p-b'),
      },
      1_001,
    ).state;

    expect(state.status).toBe('planning');
    expect(Object.keys(state.planning?.submissions ?? {}).sort()).toEqual([
      'b0',
      'b1',
    ]);
    const alphaView = createBattleMatchPlayerView(state, 'p-a', 1_002);
    const betaView = createBattleMatchPlayerView(state, 'p-b', 1_002);
    expect(alphaView.ownCommitted).toBe(false);
    expect(alphaView.ownSubmissions).toEqual({});
    expect(betaView.ownCommitted).toBe(true);
    expect(betaView).not.toHaveProperty('committedPlayerIds');

    state = transitionBattleMatch(
      state,
      {
        type: 'commit_player_intents',
        matchId: 'match-test',
        ...commandBase(state, 'commit-a-second'),
        playerId: 'p-a',
        intents: basicIntents('p-a'),
      },
      1_003,
    ).state;

    expect(state.status).toBe('resolving');
    expect(state.resolving?.commandSet.intents.a0).toEqual({
      kind: 'basic_attack',
      targetUnitId: 'b0',
      submittedBy: 'player',
    });
  });

  it('rejects an illegal intent from the submitting player before other players commit', () => {
    const state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    expect(() =>
      transitionBattleMatch(
        state,
        {
          type: 'commit_player_intents',
          matchId: 'match-test',
          ...commandBase(state, 'illegal-local-intent'),
          playerId: 'p-a',
          intents: {
            a0: { kind: 'ability', abilityId: 'unknown', targetUnitId: 'b0' },
            a1: { kind: 'basic_attack', targetUnitId: 'b0' },
          },
        },
        1_001,
      ),
    ).toThrow('cannot use ability unknown');
  });

  it('rejects cross-player intents and supports request idempotency', () => {
    const state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    expect(() =>
      transitionBattleMatch(
        state,
        {
          type: 'commit_player_intents',
          matchId: 'match-test',
          ...commandBase(state, 'bad'),
          playerId: 'p-a',
          intents: {
            a0: { kind: 'basic_attack', targetUnitId: 'b0' },
            b0: { kind: 'basic_attack', targetUnitId: 'a0' },
          },
        },
        1_001,
      ),
    ).toThrow('every living controlled unit exactly once');

    const accepted = transitionBattleMatch(
      state,
      {
        type: 'commit_player_intents',
        matchId: 'match-test',
        ...commandBase(state, 'same'),
        playerId: 'p-a',
        intents: basicIntents('p-a'),
      },
      1_001,
    );
    const duplicate = transitionBattleMatch(
      accepted.state,
      {
        type: 'commit_player_intents',
        matchId: 'match-test',
        ...commandBase(accepted.state, 'same'),
        playerId: 'p-a',
        intents: { a0: { kind: 'ability', abilityId: 'invalid' } },
      },
      1_002,
    );
    expect(duplicate.duplicateRequest).toBe(true);
    expect(duplicate.state).toEqual(accepted.state);
  });

  it('resolves all missing intents at deadline and exposes only own submissions', () => {
    const state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    const result = transitionBattleMatch(
      state,
      {
        type: 'resolve_planning_timeout',
        matchId: 'match-test',
        ...commandBase(state, 'timeout'),
      },
      31_000,
    );
    expect(result.state.status).toBe('resolving');
    expect(
      Object.values(result.state.resolving!.commandSet.intents),
    ).toHaveLength(4);
    expect(Object.values(result.state.resolving!.commandSet.intents)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'basic_attack',
          submittedBy: 'timeout',
        }),
      ]),
    );

    const view = createBattleMatchPlayerView(state, 'p-a', 1_500);
    expect(view.planningView?.units).toHaveLength(2);
    expect(view.publicSnapshot.units).toHaveLength(4);
    expect(view.publicSnapshot.version).toBe('battle_public_snapshot_v1');
    expect(view.ownSubmissions).toEqual({});
    expect(JSON.stringify(view)).toContain('b0');
    expect(JSON.stringify(view)).not.toContain('battle_save_v1');
  });

  it('fills a missing queued action only when the trusted deadline is reached', () => {
    const state = createBattleMatchState({
      matchId: 'match-test',
      battle: save({ queuedUnitId: 'a0' }),
      controllers,
      now: 1_000,
    });
    const result = transitionBattleMatch(
      state,
      {
        type: 'resolve_planning_timeout',
        matchId: 'match-test',
        ...commandBase(state, 'queued-timeout'),
      },
      31_000,
    );
    expect(result.state.status).toBe('resolving');
    expect(result.state.resolving?.commandSet.intents.a0).toEqual({
      kind: 'basic_attack',
      targetUnitId: 'b0',
      submittedBy: 'timeout',
    });
  });

  it('returns to planning after applying a non-terminal resolution', () => {
    let state = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    const transition = transitionBattleMatch(
      state,
      {
        type: 'resolve_planning_timeout',
        matchId: 'match-test',
        ...commandBase(state, 'timeout'),
      },
      31_000,
    );
    state = transition.state;
    const resolution = {
      version: 'battle_round_resolution_v1' as const,
      commandSetId: state.resolving!.commandSet.commandSetId,
      round: 1,
      outcome: { battleEnded: false },
      sequences: [],
      stateTimeline: {
        version: 'battle_state_timeline_v3' as const,
        frames: [],
      },
      checkpoint: {
        ...state.battle.checkpoint,
        round: 1,
        checkpointRevision: 1,
      },
      save: {
        ...state.battle,
        checkpoint: {
          ...state.battle.checkpoint,
          round: 1,
          checkpointRevision: 1,
        },
      },
    };
    const next = applyBattleRoundResolution(state, resolution, 32_000);
    expect(next.status).toBe('planning');
    expect(next.planning?.round).toBe(2);
    const view = createBattleMatchPlayerView(next, 'p-a', 32_001);
    expect(view.latestResolution?.version).toBe(
      'battle_round_resolution_public_v1',
    );
    expect(JSON.stringify(view.latestResolution)).not.toContain(
      'battle_save_v1',
    );
    expect(view.latestResolution).not.toHaveProperty('stateTimeline');
  });

  it('freezes deterministic failures without leaking diagnostics and supports retry or abort', () => {
    const planning = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    const resolving = transitionBattleMatch(
      planning,
      {
        type: 'resolve_planning_timeout',
        matchId: 'match-test',
        ...commandBase(planning, 'timeout-failure'),
      },
      31_000,
    ).state;
    const failed = markBattleResolutionFailed(
      resolving,
      new Error('private resolver diagnostic'),
      31_100,
    );
    const view = createBattleMatchPlayerView(failed, 'p-a', 31_101);

    expect(failed.status).toBe('resolution_failed');
    expect(failed.resolving?.failure).toMatchObject({
      code: 'BATTLE_ROUND_RESOLUTION_FAILED',
      message: 'private resolver diagnostic',
    });
    expect(view.round).toBe(1);
    expect(view.resolutionFailure?.fingerprint).toMatch(/^resolution-/);
    expect(view.resolutionFailure).not.toHaveProperty('message');

    const retried = retryFailedBattleResolution(failed, 31_200);
    expect(retried.status).toBe('resolving');
    expect(retried.resolving?.failure).toBeUndefined();

    const cancelled = cancelBattleResolution(failed, 31_300);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.resolving).toBeUndefined();
  });

  it('preserves the resolution limit code in the private state and public failure view', () => {
    const planning = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    const resolving = transitionBattleMatch(
      planning,
      {
        type: 'resolve_planning_timeout',
        matchId: 'match-test',
        ...commandBase(planning, 'timeout-limit'),
      },
      31_000,
    ).state;
    const failed = markBattleResolutionFailed(
      resolving,
      new BattleResolutionError(
        'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
        'private limit diagnostic',
      ),
      31_100,
    );
    const view = createBattleMatchPlayerView(failed, 'p-a', 31_101);

    expect(failed.resolving?.failure).toMatchObject({
      code: 'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
      message: 'private limit diagnostic',
    });
    expect(view.resolutionFailure).toMatchObject({
      code: 'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
      failedAt: 31_100,
    });
    expect(view.resolutionFailure).not.toHaveProperty('message');
  });
});
