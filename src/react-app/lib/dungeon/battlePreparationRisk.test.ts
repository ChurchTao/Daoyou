import { describe, expect, it } from 'vitest';
import { evaluateBattlePreparationRisk } from './battlePreparationRisk';
import type { Cultivator } from '@shared/types/cultivator';

function cultivator(overrides: Partial<Cultivator> = {}): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    title: null,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 120,
    attributes: {
      vitality: 20,
      spirit: 20,
      wisdom: 20,
      speed: 20,
      willpower: 20,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    spirit_stones: 0,
    ...overrides,
  };
}

describe('evaluateBattlePreparationRisk', () => {
  it('warns when enemy realm is higher', () => {
    const risk = evaluateBattlePreparationRisk(
      cultivator(),
      cultivator({ realm: '筑基' }),
    );

    expect(risk.shouldWarn).toBe(true);
    expect(risk.enemyRealmHigher).toBe(true);
    expect(risk.message).toContain('境界高过你');
  });

  it('warns when enemy attributes pressure the player', () => {
    const risk = evaluateBattlePreparationRisk(
      cultivator(),
      cultivator({
        attributes: {
          vitality: 30,
          spirit: 30,
          wisdom: 30,
          speed: 30,
          willpower: 30,
        },
      }),
    );

    expect(risk.shouldWarn).toBe(true);
    expect(risk.enemyAttributePressure).toBe(true);
  });

  it('does not warn for comparable enemies', () => {
    expect(
      evaluateBattlePreparationRisk(cultivator(), cultivator()).shouldWarn,
    ).toBe(false);
  });
});
