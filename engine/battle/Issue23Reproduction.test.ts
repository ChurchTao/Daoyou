import type { Cultivator } from '@/types/cultivator';
import { EffectTrigger, EffectType, StatModifierType } from '../effect/types';
import { BattleUnit } from './BattleUnit';

describe('Issue #23 Reproduction: Multiplicative Stat Bloat', () => {
  const createBaseCultivator = (
    overrides: Partial<Cultivator> = {},
  ): Cultivator => ({
    id: 'test_cultivator',
    name: 'TestCultivator',
    gender: '男',
    title: 'Test',
    realm: '炼气',
    realm_stage: '初期',
    age: 18,
    lifespan: 100,
    spiritual_roots: [],
    attributes: {
      vitality: 100,
      spirit: 100,
      wisdom: 100,
      speed: 100,
      willpower: 100,
    },
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
    max_skills: 5,
    spirit_stones: 0,
    ...overrides,
  });

  test('REPRODUCTION: Two +50% Spirit modifiers should result in 200, not 225', () => {
    const cultivator = createBaseCultivator({
      attributes: {
        vitality: 100,
        spirit: 100, // Base Spirit = 100
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
      inventory: {
        artifacts: [
          {
            id: 'buff_1',
            name: 'Spirit Buff 1',
            element: '金',
            slot: 'weapon',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: EffectTrigger.ON_STAT_CALC,
                params: {
                  stat: 'spirit',
                  value: 0.5,
                  modType: StatModifierType.PERCENT,
                },
              },
            ],
          },
          {
            id: 'buff_2',
            name: 'Spirit Buff 2',
            element: '水',
            slot: 'accessory',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: EffectTrigger.ON_STAT_CALC,
                params: {
                  stat: 'spirit',
                  value: 0.5,
                  modType: StatModifierType.PERCENT,
                },
              },
            ],
          },
        ],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: 'buff_1',
        armor: null,
        accessory: 'buff_2',
      },
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    // EXPECTED (Additive): 100 * (1 + 0.5 + 0.5) = 200
    // ACTUAL (Multiplicative): 100 * 1.5 * 1.5 = 225

    expect(finalAttrs.spirit).toBe(200);
  });

  test('COMPLEX: Base (100) + Fixed (50) + Percent1 (+50%) + Percent2 (+50%) = 250', () => {
    // Explanation:
    // Base is 100. Fixed adds 50 -> 150.
    // Percentages are added together: 50% + 50% = 100%.
    // Base is 100 (init value in process). So total percent bonus is 100 * 100% = 100.
    // Final = 100 (base) + 50 (fixed) + 100 (percent) = 250.
    // Note: If Fixed was treated as part of base for percentage calc, it would be (100+50) * 2 = 300.
    // But per spec, it should be based on Base Value.

    const cultivator = createBaseCultivator({
      attributes: {
        vitality: 100,
        spirit: 0,
        wisdom: 0,
        speed: 0,
        willpower: 0,
      },
      inventory: {
        artifacts: [
          {
            id: 'mod_1',
            name: 'Fixed +50',
            element: '金',
            slot: 'weapon',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: EffectTrigger.ON_STAT_CALC,
                params: {
                  stat: 'vitality',
                  value: 50,
                  modType: StatModifierType.FIXED,
                },
              },
            ],
          },
          {
            id: 'mod_2',
            name: 'Percent +50%',
            element: '木',
            slot: 'armor',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: EffectTrigger.ON_STAT_CALC,
                params: {
                  stat: 'vitality',
                  value: 0.5,
                  modType: StatModifierType.PERCENT,
                },
              },
            ],
          },
          {
            id: 'mod_3',
            name: 'Percent +50%',
            element: '水',
            slot: 'accessory',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: EffectTrigger.ON_STAT_CALC,
                params: {
                  stat: 'vitality',
                  value: 0.5,
                  modType: StatModifierType.PERCENT,
                },
              },
            ],
          },
        ],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: 'mod_1',
        armor: 'mod_2',
        accessory: 'mod_3',
      },
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    // Base: 100
    // Fixed: +50
    // Percent: 100 * (0.5 + 0.5) = +100
    // Total: 250
    expect(finalAttrs.vitality).toBe(250);
  });
});
