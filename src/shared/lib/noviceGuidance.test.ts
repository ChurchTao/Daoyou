import { describe, expect, it } from 'vitest';
import {
  NOVICE_EQUIPMENT,
  evaluateNoviceReadiness,
} from './noviceGuidance';
import type { Consumable, Cultivator } from '@shared/types/cultivator';

function healingPill(): Consumable {
  return {
    id: 'pill-heal',
    name: '回春丹',
    type: 'pill',
    quality: '凡品',
    quantity: 1,
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'percent',
          value: 0.2,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['青露草'],
        analysisVersion: 2,
        propertyVector: [{ key: 'restore_hp', weight: 1 }],
        sourceMaterialVectors: [],
        stability: 80,
        toxicityRating: 5,
        tags: ['healing'],
      },
    },
  };
}

function createCultivator(overrides: Partial<Cultivator> = {}): Cultivator {
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
      artifacts: NOVICE_EQUIPMENT.map((equipment) => ({
        id: `artifact-${equipment.slot}`,
        name: equipment.name,
        slot: equipment.slot,
        element: '木',
      })),
      consumables: [healingPill()],
      materials: [],
    },
    equipped: {
      weapon: 'artifact-weapon',
      armor: 'artifact-armor',
      accessory: 'artifact-accessory',
    },
    spirit_stones: 0,
    cultivation_progress: {
      cultivation_exp: 0,
      exp_cap: 1000,
      comprehension_insight: 0,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
    ...overrides,
  };
}

describe('evaluateNoviceReadiness', () => {
  it('passes the first dungeon when resources and novice equipment are ready', () => {
    const readiness = evaluateNoviceReadiness({
      cultivator: createCultivator(),
      selectedNodeRealm: '炼气',
      hp: { current: 90, max: 100 },
      mp: { current: 90, max: 100 },
      isFirstDungeonTutorialActive: true,
    });

    expect(readiness.shouldBlock).toBe(false);
    expect(readiness.hasEquippedFullNoviceEquipment).toBe(true);
    expect(readiness.hasRecoveryPill).toBe(true);
  });

  it('blocks the first dungeon when hp is low but only warns about unequipped novice equipment', () => {
    const readiness = evaluateNoviceReadiness({
      cultivator: createCultivator({
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      }),
      selectedNodeRealm: '炼气',
      hp: { current: 50, max: 100 },
      mp: { current: 90, max: 100 },
      isFirstDungeonTutorialActive: true,
    });

    expect(readiness.shouldBlock).toBe(true);
    expect(readiness.reasons).toEqual(
      expect.arrayContaining([
        '气血仅 50%，低于首次探秘建议值。',
      ]),
    );
    expect(readiness.reasons).not.toEqual(
      expect.arrayContaining([
        '入门装备尚未穿戴完整：入门青竹剑、入门护身布甲、入门护身玉佩。',
      ]),
    );
    expect(readiness.hints).toEqual(
      expect.arrayContaining([
        '建议先去储物袋穿戴入门青竹剑、入门护身布甲、入门护身玉佩，但也可以直接开始低危探秘。',
      ]),
    );
  });

  it('does not block the first dungeon when only novice equipment is unequipped', () => {
    const readiness = evaluateNoviceReadiness({
      cultivator: createCultivator({
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      }),
      selectedNodeRealm: '炼气',
      hp: { current: 90, max: 100 },
      mp: { current: 90, max: 100 },
      isFirstDungeonTutorialActive: true,
    });

    expect(readiness.shouldBlock).toBe(false);
    expect(readiness.reasons).toEqual([]);
    expect(readiness.hints).toEqual(
      expect.arrayContaining([
        '建议先去储物袋穿戴入门青竹剑、入门护身布甲、入门护身玉佩，但也可以直接开始低危探秘。',
      ]),
    );
  });

  it('does not block after the first dungeon tutorial is completed', () => {
    const readiness = evaluateNoviceReadiness({
      cultivator: createCultivator({
        inventory: {
          artifacts: [],
          consumables: [],
          materials: [],
        },
      }),
      selectedNodeRealm: '筑基',
      hp: { current: 1, max: 100 },
      mp: { current: 1, max: 100 },
      isFirstDungeonTutorialActive: false,
    });

    expect(readiness.shouldBlock).toBe(false);
  });
});
