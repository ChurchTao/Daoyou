import { describe, expect, it } from 'vitest';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import { BattleRoster } from './BattleRoster';
import type { TeamId, TeamSlot } from './types';

function unit(
  id: string,
  teamId: TeamId,
  slot: TeamSlot,
  runtime: BattleRuntime,
): Unit {
  return new Unit(id, id, {}, { teamId, slot, runtime });
}

describe('BattleRoster', () => {
  it('models two teams of up to four units in stable slot order', () => {
    const runtime = new BattleRuntime();
    const roster = new BattleRoster([
      unit('a2', 'alpha', 2, runtime),
      unit('b1', 'beta', 1, runtime),
      unit('a0', 'alpha', 0, runtime),
      unit('b0', 'beta', 0, runtime),
      unit('a1', 'alpha', 1, runtime),
      unit('b2', 'beta', 2, runtime),
      unit('a3', 'alpha', 3, runtime),
      unit('b3', 'beta', 3, runtime),
    ]);

    expect(roster.getTeam('alpha').unitIds).toEqual(['a0', 'a1', 'a2', 'a3']);
    expect(roster.getAllies('a0').map((member) => member.id)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
    expect(roster.getEnemies('a0').map((member) => member.id)).toEqual([
      'b0',
      'b1',
      'b2',
      'b3',
    ]);
  });

  it('rejects duplicate unit ids and duplicate team slots', () => {
    const runtime = new BattleRuntime();
    expect(
      () =>
        new BattleRoster([
          unit('same', 'alpha', 0, runtime),
          unit('same', 'beta', 0, runtime),
        ]),
    ).toThrow('Duplicate battle unit id');

    expect(
      () =>
        new BattleRoster([
          unit('a0', 'alpha', 0, runtime),
          unit('a1', 'alpha', 0, runtime),
          unit('b0', 'beta', 0, runtime),
        ]),
    ).toThrow('Duplicate slot');
  });

  it('keeps the legacy duel adapter valid', () => {
    const runtime = new BattleRuntime();
    const left = new Unit('left', 'left', {}, { runtime });
    const right = new Unit('right', 'right', {}, { runtime });
    const roster = BattleRoster.fromDuel(left, right);

    expect(roster.teams.size).toBe(2);
    expect(roster.getEnemies(left.id)).toEqual([right]);
  });
});
