import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../engine/battle-v5/core/BattleRoster';
import { AttributeType } from '../engine/battle-v5/core/types';
import { createBattleMatchState } from '../engine/battle-v5/match/BattleMatchStateMachine';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '../engine/battle-v5/persistence/BattleStateCodec';
import { BattleRuntime } from '../engine/battle-v5/runtime/BattleRuntime';
import { Unit } from '../engine/battle-v5/units/Unit';
import {
  assertOnlineBattleRuntimeState,
  createOnlineBattleRuntimeState,
} from './onlineBattleRuntime';

function createRuntime() {
  const battleRuntime = new BattleRuntime();
  try {
    const roster = new BattleRoster([
      new Unit(
        'alpha-0',
        'alpha',
        { [AttributeType.SPEED]: 10 },
        { runtime: battleRuntime, teamId: 'alpha', slot: 0 },
      ),
      new Unit(
        'beta-0',
        'beta',
        {},
        { runtime: battleRuntime, teamId: 'beta', slot: 0 },
      ),
    ]);
    const blueprint = createBattleBlueprint('runtime-contract', roster);
    const match = createBattleMatchState({
      matchId: 'runtime-contract',
      battle: {
        version: 'battle_save_v1',
        blueprint,
        checkpoint: captureBattleCheckpoint({
          blueprint,
          roster,
          runtime: battleRuntime,
          round: 0,
          checkpointRevision: 0,
        }),
      },
      controllers: [
        { playerId: 'player-alpha', teamId: 'alpha', unitIds: ['alpha-0'] },
        { playerId: 'player-beta', teamId: 'beta', unitIds: ['beta-0'] },
      ],
      now: 1_000,
    });
    return createOnlineBattleRuntimeState({
      match,
      acceptedPlayerIds: ['player-alpha', 'player-beta'],
    });
  } finally {
    battleRuntime.dispose();
  }
}

describe('online battle runtime persistence contract', () => {
  it('accepts a complete internally consistent planning runtime', () => {
    const runtime = createRuntime();
    expect(() => assertOnlineBattleRuntimeState(runtime)).not.toThrow();
  });

  it('rejects phase fields that disagree with the status', () => {
    const runtime = createRuntime();
    const invalid = {
      ...runtime,
      match: { ...runtime.match, status: 'waiting' },
    };
    expect(() => assertOnlineBattleRuntimeState(invalid)).toThrow(
      'waiting phase fields are inconsistent',
    );
  });

  it('rejects accepted players outside the controller set and embedded receipts', () => {
    const runtime = createRuntime();
    expect(() =>
      assertOnlineBattleRuntimeState({
        ...runtime,
        acceptedPlayerIds: [...runtime.acceptedPlayerIds, 'intruder'],
      }),
    ).toThrow('accepted player is not a controller');
    expect(() =>
      assertOnlineBattleRuntimeState({
        ...runtime,
        commandReceiptsByPlayerId: {},
      }),
    ).toThrow('obsolete embedded command receipts');
  });

  it('rejects player acceptance that disagrees with the active phase', () => {
    const runtime = createRuntime();
    expect(() =>
      assertOnlineBattleRuntimeState({
        ...runtime,
        acceptedPlayerIds: ['player-alpha'],
      }),
    ).toThrow('planning state does not have every player');
    expect(() =>
      assertOnlineBattleRuntimeState({
        ...runtime,
        match: { ...runtime.match, status: 'waiting', planning: undefined },
      }),
    ).toThrow('waiting state already has every player');
  });

  it('rejects replay hand-off material in persisted Redis runtime', () => {
    const runtime = createRuntime();
    expect(() =>
      assertOnlineBattleRuntimeState({
        ...runtime,
        replay: {
          version: 'battle_replay_accumulator_v1',
          pendingRound: {},
        },
      }),
    ).toThrow('contains a pending replay round');
  });

  it('rejects presentation hand-off material in persisted Redis runtime', () => {
    const runtime = createRuntime();
    expect(() =>
      assertOnlineBattleRuntimeState({
        ...runtime,
        pendingPresentationWindow: {},
      }),
    ).toThrow('presentation hand-off exists outside presenting');
  });
});
