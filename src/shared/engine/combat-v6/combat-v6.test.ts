import { describe, expect, it } from 'vitest';
import {
  CommandType,
  HpZeroOutcome,
  createBattle,
  type Ruleset,
} from './index.ts';

const deterministicRules: Ruleset = {
  name: 'combat-v6-copy-smoke',
  maxRounds: 10,
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    critMultiplier: 2,
    furyAtkMultiplier: 1,
    defendPhysicalFactor: 0.5,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) =>
      Math.max(1, attack - defense + power),
    baseDamage: ({ source, target, power }) =>
      Math.max(1, source.attrs.physicalAtk - target.attrs.physicalDef + power),
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    sealHitChance: () => 1,
    fleeChance: () => 0,
  },
  hpZeroOutcome: () => HpZeroOutcome.Dead,
  decideCommand: ({ enemies }) =>
    enemies[0]
      ? { type: CommandType.Attack, target: enemies[0].id }
      : { type: CommandType.Defend },
};

describe('combat-v6 copied core', () => {
  it('resolves a deterministic we-go battle through the public entrypoint', () => {
    const battle = createBattle({
      seed: 42,
      ruleset: deterministicRules,
      units: [
        {
          id: 'fast',
          name: '快者',
          side: 0,
          kind: 'npc',
          attrs: {
            hp: 20,
            speed: 10,
            physicalAtk: 10,
            physicalDef: 0,
          },
        },
        {
          id: 'slow',
          name: '慢者',
          side: 1,
          kind: 'npc',
          attrs: {
            hp: 10,
            speed: 5,
            physicalAtk: 5,
            physicalDef: 0,
          },
        },
      ],
    });

    battle.lockAndResolve();

    expect(battle.finished).toBe(true);
    expect(battle.state.result).toEqual({ winner: 0, reason: 'wipe' });
    expect(battle.unit('slow').flags.dead).toBe(true);
  });
});
