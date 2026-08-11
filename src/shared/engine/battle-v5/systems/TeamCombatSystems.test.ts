import { describe, expect, it } from 'vitest';
import { TargetPolicy } from '../abilities/TargetPolicy';
import type { BattleRandomSource } from '../core/BattleRandom';
import { BattleRoster } from '../core/BattleRoster';
import { AttributeType, type TeamId, type TeamSlot } from '../core/types';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import { InitiativeSystem } from './InitiativeSystem';
import { TargetSelectionSystem } from './TargetSelectionSystem';
import { TeamVictorySystem } from './TeamVictorySystem';

function unit(
  id: string,
  teamId: TeamId,
  slot: TeamSlot,
  runtime: BattleRuntime,
  speed = 0,
): Unit {
  return new Unit(
    id,
    id,
    { [AttributeType.SPEED]: speed, [AttributeType.VITALITY]: 10 },
    { teamId, slot, runtime },
  );
}

function sequenceRandom(values: number[]): BattleRandomSource {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
}

describe('team combat systems', () => {
  it('selects allies, enemies and AOE targets by team', () => {
    const runtime = new BattleRuntime();
    const units = [
      unit('a0', 'alpha', 0, runtime),
      unit('a1', 'alpha', 1, runtime),
      unit('b0', 'beta', 0, runtime),
      unit('b1', 'beta', 1, runtime),
      unit('b2', 'beta', 2, runtime),
    ];
    const targets = new TargetSelectionSystem();

    expect(
      targets
        .selectTargets(
          units[0],
          new TargetPolicy({ team: 'ally', scope: 'aoe', maxTargets: 4 }),
          units,
        )
        .map((target) => target.id),
    ).toEqual(['a1']);
    expect(
      targets
        .selectTargets(
          units[0],
          new TargetPolicy({ team: 'enemy', scope: 'aoe', maxTargets: 2 }),
          units,
        )
        .map((target) => target.id),
    ).toEqual(['b0', 'b1']);
  });

  it('uses deterministic Fisher-Yates tie breaks after speed grouping', () => {
    const runtime = new BattleRuntime();
    const slow = unit('slow', 'alpha', 0, runtime, 1);
    const fastA = unit('fast-a', 'alpha', 1, runtime, 10);
    const fastB = unit('fast-b', 'beta', 0, runtime, 10);

    expect(
      InitiativeSystem.order(
        [slow, fastA, fastB],
        sequenceRandom([0.1]),
      ).map((member) => member.id),
    ).toEqual(['fast-b', 'fast-a', 'slow']);
  });

  it('ends only when a whole team is eliminated', () => {
    const runtime = new BattleRuntime();
    const a0 = unit('a0', 'alpha', 0, runtime);
    const a1 = unit('a1', 'alpha', 1, runtime);
    const b0 = unit('b0', 'beta', 0, runtime);
    const b1 = unit('b1', 'beta', 1, runtime);
    const roster = new BattleRoster([a0, a1, b0, b1]);

    b0.setHp(0);
    expect(TeamVictorySystem.check(roster, runtime.random)).toEqual({ battleEnded: false });
    b1.setHp(0);
    expect(TeamVictorySystem.check(roster, runtime.random)).toEqual({
      battleEnded: true,
      winnerTeamId: 'alpha',
      loserTeamId: 'beta',
    });
  });

  it('uses combat-state scores before the deterministic random tiebreaker', () => {
    const runtime = new BattleRuntime();
    const alpha = unit('alpha-unit', 'alpha', 0, runtime);
    const beta = unit('beta-unit', 'beta', 0, runtime);
    const roster = new BattleRoster([alpha, beta]);

    alpha.setHp(alpha.getMaxHp() / 2);
    beta.setHp(beta.getMaxHp() / 4);

    expect(
      TeamVictorySystem.check(roster, sequenceRandom([0.99]), 30),
    ).toMatchObject({
      battleEnded: true,
      winnerTeamId: 'alpha',
      loserTeamId: 'beta',
      reachedMaxRounds: true,
    });
  });

  it('deterministically resolves an otherwise exact tie', () => {
    const runtime = new BattleRuntime();
    const alpha = unit('alpha-unit', 'alpha', 0, runtime);
    const beta = unit('beta-unit', 'beta', 0, runtime);
    const roster = new BattleRoster([alpha, beta]);

    alpha.setHp(0);
    beta.setHp(0);

    expect(TeamVictorySystem.check(roster, sequenceRandom([0.75]))).toEqual({
      battleEnded: true,
      winnerTeamId: 'beta',
      loserTeamId: 'alpha',
    });
  });
});
