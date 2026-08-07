import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { BattleStateRecorder } from '../systems/state/BattleStateRecorder';
import { toBattleStateTimelineV3 } from '../v3/BattleRecordV3';
import { Unit } from '../units/Unit';
import {
  createBattleRecordV4,
  validateBattleRecordV4,
} from './BattleRecordV4';

describe('BattleRecordV4', () => {
  it('records all team members and validates an eliminated team', () => {
    const runtime = new BattleRuntime();
    const units = [
      new Unit('a0', 'a0', {}, { runtime, teamId: 'alpha', slot: 0 }),
      new Unit('a1', 'a1', {}, { runtime, teamId: 'alpha', slot: 1 }),
      new Unit('b0', 'b0', {}, { runtime, teamId: 'beta', slot: 0 }),
      new Unit('b1', 'b1', {}, { runtime, teamId: 'beta', slot: 1 }),
    ];
    units[2].setHp(0);
    units[3].setHp(0);
    const roster = new BattleRoster(units);
    const recorder = new BattleStateRecorder();
    recorder.record('battle_end', 1, units, undefined, 'sequence_end');

    const record = createBattleRecordV4({
      roster,
      outcome: {
        battleEnded: true,
        winnerTeamId: 'alpha',
        loserTeamId: 'beta',
      },
      rounds: 1,
      sequences: [],
      stateTimeline: toBattleStateTimelineV3(recorder.getTimeline(units)),
    });

    expect(record.teams.map((team) => team.units.length)).toEqual([2, 2]);
    expect(record.outcome).toEqual({
      result: 'victory',
      winnerTeamId: 'alpha',
      loserTeamId: 'beta',
      rounds: 1,
      reason: 'elimination',
    });
    expect(() => validateBattleRecordV4(record)).not.toThrow();
  });

  it('rejects a final snapshot set that omits a participant', () => {
    const runtime = new BattleRuntime();
    const left = new Unit('left', 'left', {}, { runtime });
    const right = new Unit('right', 'right', {}, { runtime });
    right.setHp(0);
    const roster = BattleRoster.fromDuel(left, right);
    const recorder = new BattleStateRecorder();
    recorder.record('battle_end', 1, [left, right], undefined, 'sequence_end');
    const record = createBattleRecordV4({
      roster,
      outcome: {
        battleEnded: true,
        winnerTeamId: left.teamId,
        loserTeamId: right.teamId,
      },
      rounds: 1,
      sequences: [],
      stateTimeline: toBattleStateTimelineV3(
        recorder.getTimeline([left, right]),
      ),
    });

    delete record.finalSnapshots[right.id];
    expect(() => validateBattleRecordV4(record)).toThrow('final snapshots');
  });
});
