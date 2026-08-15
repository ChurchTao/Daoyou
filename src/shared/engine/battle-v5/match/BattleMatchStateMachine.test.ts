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
  cancelBattleMatch,
  completeBattlePresentation,
  createBattleMatchPlayerView,
  createBattleMatchViewProjection,
  createBattleMatchState,
  markBattleResolutionFailed,
  markBattlePresentationReady,
  retryFailedBattleResolution,
  transitionBattleMatch,
} from './BattleMatchStateMachine';
import type { BattleControllerV1, BattleMatchStateV1 } from './types';

function save(
  options: { queuedUnitId?: string; noActionUnitId?: string } = {},
): BattleSaveV1 {
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
  units
    .find((unit) => unit.id === options.noActionUnitId)
    ?.tags.addTags([GameplayTags.STATUS.CONTROL.NO_BASIC]);
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

  it('isolates planning units when multiple players share one team', () => {
    const state = createBattleMatchState({
      matchId: 'shared-team-match',
      battle: save(),
      controllers: [
        { playerId: 'p-a1', teamId: 'a', unitIds: ['a0'] },
        { playerId: 'p-a2', teamId: 'a', unitIds: ['a1'] },
        { playerId: 'p-b', teamId: 'b', unitIds: ['b0', 'b1'] },
      ],
      now: 1_000,
    });
    const projection = createBattleMatchViewProjection(state);

    expect(
      createBattleMatchPlayerView(state, 'p-a1', 1_001, projection)
        .planningView?.units.map((unit) => unit.unitId),
    ).toEqual(['a0']);
    expect(
      createBattleMatchPlayerView(state, 'p-a2', 1_001, projection)
        .planningView?.units.map((unit) => unit.unitId),
    ).toEqual(['a1']);
  });

  it('does not wait for a player whose controlled units are all dead', () => {
    const battle = save();
    battle.checkpoint.units.a0!.hp = 0;
    battle.checkpoint.units.a1!.hp = 0;
    const state = createBattleMatchState({
      matchId: 'eliminated-player-match',
      battle,
      controllers,
      now: 1_000,
    });

    expect(state.planning?.committedPlayerIds).toEqual(['p-a']);
    const result = transitionBattleMatch(
      state,
      {
        type: 'resolve_planning_timeout',
        matchId: 'eliminated-player-match',
        ...commandBase(state, 'resolve-after-elimination'),
      },
      31_001,
    );

    expect(result.state.status).toBe('resolving');
    expect(Object.keys(result.state.resolving!.commandSet.intents).sort()).toEqual([
      'b0',
      'b1',
    ]);
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
    const projection = createBattleMatchViewProjection(state);
    const alphaView = createBattleMatchPlayerView(
      state,
      'p-a',
      1_002,
      projection,
    );
    const betaView = createBattleMatchPlayerView(
      state,
      'p-b',
      1_002,
      projection,
    );
    expect(alphaView).toEqual(createBattleMatchPlayerView(state, 'p-a', 1_002));
    expect(alphaView.publicSnapshot).toEqual(betaView.publicSnapshot);
    expect(alphaView.planningView?.units.map((unit) => unit.unitId)).toEqual([
      'a0',
      'a1',
    ]);
    expect(betaView.planningView?.units.map((unit) => unit.unitId)).toEqual([
      'b0',
      'b1',
    ]);
    expect(
      alphaView.planningView?.units.every((unit) =>
        controllers[0]!.unitIds.includes(unit.unitId),
      ),
    ).toBe(true);
    expect(
      betaView.planningView?.units.every((unit) =>
        controllers[1]!.unitIds.includes(unit.unitId),
      ),
    ).toBe(true);
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

  it('uses skip when a timed-out unit has no legal action', () => {
    const state = createBattleMatchState({
      matchId: 'match-test',
      battle: save({ noActionUnitId: 'a0' }),
      controllers,
      now: 1_000,
    });
    const result = transitionBattleMatch(
      state,
      {
        type: 'resolve_planning_timeout',
        matchId: 'match-test',
        ...commandBase(state, 'timeout-skip'),
      },
      31_000,
    );
    expect(result.state.resolving?.commandSet.intents.a0).toEqual({
      kind: 'skip',
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
    const presenting = applyBattleRoundResolution(state, resolution, 32_000, {
      resultId: 'result-1',
      startedAt: 32_000,
      readyAcceptedAt: 33_500,
      scheduledEndsAt: 40_000,
    });
    expect(presenting.status).toBe('presenting');
    expect(presenting.planning).toBeUndefined();
    const oneReady = markBattlePresentationReady(
      presenting,
      'p-a',
      'result-1',
      34_000,
    );
    expect(oneReady.status).toBe('presenting');
    const allReady = markBattlePresentationReady(
      oneReady,
      'p-b',
      'result-1',
      34_100,
    );
    expect(allReady.status).toBe('presenting');
    expect(allReady.presentation?.readyPlayerIds).toEqual(['p-a', 'p-b']);
    const earlyReadyA = markBattlePresentationReady(
      presenting,
      'p-a',
      'result-1',
      32_500,
    );
    const earlyReadyAll = markBattlePresentationReady(
      earlyReadyA,
      'p-b',
      'result-1',
      32_600,
    );
    expect(earlyReadyAll.status).toBe('presenting');
    const heldUntilScheduledEnd = completeBattlePresentation(
      earlyReadyAll,
      39_999,
    );
    expect(heldUntilScheduledEnd.status).toBe('presenting');
    const next = completeBattlePresentation(allReady, 40_000);
    expect(next.status).toBe('planning');
    expect(next.planning).toMatchObject({
      round: 2,
      opensAt: 40_000,
      deadlineAt: 70_000,
    });
    const view = createBattleMatchPlayerView(next, 'p-a', 40_001);
    expect(view.latestResolution?.version).toBe(
      'battle_round_resolution_public_v1',
    );
    expect(JSON.stringify(view.latestResolution)).not.toContain(
      'battle_save_v1',
    );
    expect(view.latestResolution).not.toHaveProperty('stateTimeline');
  });

  it('does not auto-ready an eliminated player during the presentation phase', () => {
    const battle = save();
    battle.checkpoint.units.a0!.hp = 0;
    battle.checkpoint.units.a1!.hp = 0;
    const planning = createBattleMatchState({
      matchId: 'eliminated-presentation-match',
      battle,
      controllers,
      now: 1_000,
    });
    const resolving = transitionBattleMatch(
      planning,
      {
        type: 'resolve_planning_timeout',
        matchId: 'eliminated-presentation-match',
        ...commandBase(planning, 'timeout-eliminated-presentation'),
      },
      31_000,
    ).state;
    const nextSave = {
      ...battle,
      checkpoint: {
        ...battle.checkpoint,
        round: 1,
        checkpointRevision: 1,
      },
    };
    const presenting = applyBattleRoundResolution(
      resolving,
      {
        version: 'battle_round_resolution_v1',
        commandSetId: resolving.resolving!.commandSet.commandSetId,
        round: 1,
        outcome: { battleEnded: false },
        sequences: [],
        stateTimeline: {
          version: 'battle_state_timeline_v3',
          frames: [],
        },
        checkpoint: nextSave.checkpoint,
        save: nextSave,
      },
      32_000,
      {
        resultId: 'eliminated-presentation-result',
        startedAt: 32_000,
        readyAcceptedAt: 33_500,
        scheduledEndsAt: 40_000,
      },
    );

    expect(presenting.presentation?.readyPlayerIds).toEqual([]);
    const survivorReady = markBattlePresentationReady(
      presenting,
      'p-b',
      'eliminated-presentation-result',
      34_000,
    );
    expect(survivorReady.status).toBe('presenting');
    expect(survivorReady.presentation?.readyPlayerIds).toEqual(['p-b']);
    const advanced = completeBattlePresentation(survivorReady, 40_000);
    expect(advanced.status).toBe('planning');
    expect(advanced.planning?.committedPlayerIds).toContain('p-a');
  });

  it('keeps a terminal presentation alive until its scheduled end', () => {
    const planning = createBattleMatchState({
      matchId: 'terminal-presentation-match',
      battle: save(),
      controllers,
      now: 1_000,
    });
    const resolving = transitionBattleMatch(
      planning,
      {
        type: 'resolve_planning_timeout',
        matchId: 'terminal-presentation-match',
        ...commandBase(planning, 'timeout-terminal-presentation'),
      },
      31_000,
    ).state;
    const nextSave = {
      ...resolving.battle,
      checkpoint: {
        ...resolving.battle.checkpoint,
        round: 1,
        checkpointRevision: 1,
      },
    };
    const presenting = applyBattleRoundResolution(
      resolving,
      {
        version: 'battle_round_resolution_v1',
        commandSetId: resolving.resolving!.commandSet.commandSetId,
        round: 1,
        outcome: { battleEnded: true, winningTeamId: 'a' },
        sequences: [],
        stateTimeline: {
          version: 'battle_state_timeline_v3',
          frames: [],
        },
        checkpoint: nextSave.checkpoint,
        save: nextSave,
      },
      32_000,
      {
        resultId: 'terminal-presentation-result',
        startedAt: 32_000,
        readyAcceptedAt: 33_500,
        scheduledEndsAt: 40_000,
      },
    );
    const readyA = markBattlePresentationReady(
      presenting,
      'p-a',
      'terminal-presentation-result',
      34_000,
    );
    const allReady = markBattlePresentationReady(
      readyA,
      'p-b',
      'terminal-presentation-result',
      34_100,
    );

    expect(allReady.status).toBe('presenting');
    expect(completeBattlePresentation(allReady, 39_999).status).toBe(
      'presenting',
    );
    expect(completeBattlePresentation(allReady, 40_000).status).toBe(
      'finished',
    );
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

    const cancelled = cancelBattleMatch(failed, 31_300);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.resolving).toBeUndefined();
  });

  it.each([
    'waiting',
    'planning',
    'resolving',
    'presenting',
    'resolution_failed',
  ] as const)('allows technical cancellation from %s', (status) => {
    const base = createBattleMatchState({
      matchId: 'match-test',
      battle: save(),
      controllers,
      now: 1_000,
    });
    const state = {
      ...base,
      status,
      planning: status === 'planning' ? base.planning : undefined,
      resolving: status === 'resolving' || status === 'resolution_failed'
        ? {
            commandSet: {
              version: 'round_command_set_v1' as const,
              commandSetId: 'match-test:1:0',
              round: 1,
              checkpointRevision: 0,
              intents: {},
            },
            startedAt: 1_100,
          }
        : undefined,
      presentation: status === 'presenting'
        ? {
            resultId: 'result:1',
            round: 1,
            startedAt: 1_100,
            readyAcceptedAt: 1_200,
            scheduledEndsAt: 2_000,
            readyPlayerIds: [],
          }
        : undefined,
    } as BattleMatchStateV1;
    const cancelled = cancelBattleMatch(state, 2_500);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.planning).toBeUndefined();
    expect(cancelled.resolving).toBeUndefined();
    expect(cancelled.presentation).toBeUndefined();
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
