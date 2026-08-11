import { bench, describe } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import { AttributeType } from '../core/types';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '../persistence/BattleStateCodec';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import {
  createBattleMatchPlayerView,
  createBattleMatchState,
  createBattleMatchViewProjection,
} from './BattleMatchStateMachine';

const state = (() => {
  const runtime = new BattleRuntime();
  const alpha = new Unit(
    'alpha-0',
    '甲',
    { [AttributeType.VITALITY]: 20 },
    { runtime, teamId: 'alpha', slot: 0 },
  );
  const beta = new Unit(
    'beta-0',
    '乙',
    { [AttributeType.VITALITY]: 20 },
    { runtime, teamId: 'beta', slot: 0 },
  );
  const roster = BattleRoster.fromDuel(alpha, beta);
  const blueprint = createBattleBlueprint('projection-benchmark', roster);
  return createBattleMatchState({
    matchId: 'projection-benchmark',
    battle: {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 1,
      }),
    },
    controllers: [
      { playerId: 'alpha-player', teamId: 'alpha', unitIds: ['alpha-0'] },
      { playerId: 'beta-player', teamId: 'beta', unitIds: ['beta-0'] },
    ],
    now: 1_000,
  });
})();

for (const clientCount of [2, 4, 8]) {
  const playerIds = Array.from(
    { length: clientCount },
    (_, index) => index % 2 === 0 ? 'alpha-player' : 'beta-player',
  );

  describe(`${clientCount} clients`, () => {
    bench('restore per player view', () => {
      for (const playerId of playerIds) {
        createBattleMatchPlayerView(state, playerId, 1_500);
      }
    });

    bench('shared match projection', () => {
      const projection = createBattleMatchViewProjection(state);
      for (const playerId of playerIds) {
        createBattleMatchPlayerView(state, playerId, 1_500, projection);
      }
    });
  });
}
