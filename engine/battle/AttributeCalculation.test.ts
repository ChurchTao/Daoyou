import type { Cultivator } from '@/types/cultivator';
import { EffectType, StatModifierType } from '../effect/types';
import { BattleUnit } from './BattleUnit';

describe('BattleUnit Attribute Calculation', () => {
  // Helper to create a base mock cultivator
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

  // Reset effects before each test to ensure clean state
  beforeEach(() => {
    // If there were global singletons to reset, do it here.
    // BattleUnit creates its own BuffManager, so that is fine.
    // effectEngine is a singleton, but it is stateless regarding modifiers (it just processes them).
  });

  test('Should correctly calculate base attributes without any modifiers', () => {
    const cultivator = createBaseCultivator({
      attributes: {
        vitality: 50,
        spirit: 60,
        wisdom: 70,
        speed: 80,
        willpower: 90,
      },
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    expect(finalAttrs.vitality).toBe(50);
    expect(finalAttrs.spirit).toBe(60);
    expect(finalAttrs.wisdom).toBe(70);
    expect(finalAttrs.speed).toBe(80);
    expect(finalAttrs.willpower).toBe(90);

    // Check default values for combat stats
    expect(finalAttrs.critRate).toBe(0);
    expect(finalAttrs.damageReduction).toBe(0);
  });

  test('Should correctly apply equipment stat modifiers (Fixed & Percent)', () => {
    const cultivator = createBaseCultivator({
      attributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
      inventory: {
        artifacts: [
          {
            id: 'sword_1',
            name: 'Iron Sword',
            element: '金',
            slot: 'weapon',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: {
                  stat: 'vitality',
                  value: 50,
                  modType: StatModifierType.FIXED,
                },
              },
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: {
                  stat: 'wisdom',
                  value: 0.1,
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
        weapon: 'sword_1',
        armor: null,
        accessory: null,
      },
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    // Vitality: 100 + 50 = 150
    expect(finalAttrs.vitality).toBe(150);
    // Wisdom: 100 * (1 + 0.1) = 110
    expect(finalAttrs.wisdom).toBe(110);
    // Others unchanged
    expect(finalAttrs.spirit).toBe(100);
  });

  test('Should correctly apply Fate (MingGe) modifiers', () => {
    const cultivator = createBaseCultivator({
      pre_heaven_fates: [
        {
          name: 'Strong Body',
          description: 'Vitality +20',
          effects: [],
        },
      ],
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    // Vitality: 100 + 20 = 120
    expect(finalAttrs.vitality).toBe(120);
  });

  test('Should correctly calculate Critical Rate and Damage Reduction modifiers', () => {
    // These stats usually start at 0 and are added by modifiers
    const cultivator = createBaseCultivator({
      inventory: {
        artifacts: [
          {
            id: 'ring_1',
            name: 'Crit Ring',
            element: '火',
            slot: 'accessory',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: {
                  stat: 'critRate',
                  value: 0.15,
                  modType: StatModifierType.FIXED,
                }, // +15%
              },
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: {
                  stat: 'critDamage',
                  value: 0.5,
                  modType: StatModifierType.FIXED,
                }, // +50%
              },
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: {
                  stat: 'damageReduction',
                  value: 0.1,
                  modType: StatModifierType.FIXED,
                }, // +10%
              },
            ],
          },
        ],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: null,
        armor: null,
        accessory: 'ring_1',
      },
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    expect(finalAttrs.critRate).toBeCloseTo(0.15);
    expect(finalAttrs.critDamage).toBeCloseTo(0.5); // Usually base 1.5 + this 0.5 = 2.0 total, but here returns the modifier
    expect(finalAttrs.damageReduction).toBeCloseTo(0.1);
  });

  test('Should verify calculation order: Base -> Fixed -> Percent', () => {
    const cultivator = createBaseCultivator({
      attributes: {
        vitality: 100, // Base
        spirit: 100,
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
      // Simulate complicated setup:
      // 1. Fate adds 20 Fixed
      // 2. Weapon adds 30 Fixed
      // 3. Accessory adds 50% Percent
      pre_heaven_fates: [
        {
          name: 'Fate Mod',
          description: '',
          effects: [],
        },
      ],
      inventory: {
        artifacts: [
          {
            id: 'sword_1',
            name: 'Weapon Mod',
            element: '金',
            slot: 'weapon',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
                params: {
                  stat: 'vitality',
                  value: 30,
                  modType: StatModifierType.FIXED,
                },
              },
            ],
          },
          {
            id: 'ring_1',
            name: 'Accessory Mod',
            element: '木',
            slot: 'accessory',
            effects: [
              {
                type: EffectType.StatModifier,
                trigger: 'ON_STAT_CALC',
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
        weapon: 'sword_1',
        armor: null,
        accessory: 'ring_1',
      },
    });

    const unit = new BattleUnit('player', cultivator);
    const finalAttrs = unit.getFinalAttributes();

    // Calculation:
    // Base: 100
    // Fixed: +20 (Fate) + 30 (Weapon) = +50
    // Subtotal: 150
    // Percent: +50% of 150 = +75
    // Final: 225
    expect(finalAttrs.vitality).toBe(225);
  });
});
