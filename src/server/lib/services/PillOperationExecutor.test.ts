import { describe, expect, it } from 'vitest';
import { ConditionService } from './ConditionService';
import { PillOperationExecutor } from './PillOperationExecutor';
import type { Consumable, Cultivator } from '@shared/types/cultivator';

function createCultivator(): Cultivator {
  return {
    id: 'c1',
    name: '韩立',
    gender: '男',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    status: 'active',
    attributes: {
      vitality: 40,
      spirit: 36,
      wisdom: 30,
      speed: 28,
      willpower: 32,
    },
    spiritual_roots: [{ element: '木', strength: 80, grade: '真灵根' }],
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
    max_skills: 4,
    spirit_stones: 0,
  };
}

function createHealingPill(): Consumable {
  return {
    id: 'pill-1',
    name: '回春丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '回补气血。',
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        { type: 'restore_resource', resource: 'hp', mode: 'percent', value: 0.2 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['青木芝'],
        analysisVersion: 2,
        propertyVector: [{ key: 'restore_hp', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '木',
        stability: 72,
        toxicityRating: 8,
        tags: ['healing'],
      },
    },
  };
}

function createCultivationPill(): Consumable {
  return {
    id: 'pill-cultivation',
    name: '养元丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    description: '积修养元。',
    spec: {
      kind: 'pill',
      family: 'cultivation',
      operations: [
        { type: 'gain_progress', target: 'cultivation_exp', value: 48 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'cultivation',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['金霞芝'],
        analysisVersion: 2,
        propertyVector: [{ key: 'cultivation', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '金',
        stability: 72,
        toxicityRating: 9,
        tags: ['cultivation'],
      },
    },
  };
}

function createInsightPill(): Consumable {
  return {
    id: 'pill-insight',
    name: '悟心丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '启悟明心。',
    spec: {
      kind: 'pill',
      family: 'insight',
      operations: [
        {
          type: 'gain_progress',
          target: 'comprehension_insight',
          value: 12,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['寒魄晶'],
        analysisVersion: 2,
        propertyVector: [{ key: 'insight', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '冰',
        stability: 76,
        toxicityRating: 5,
        tags: ['insight'],
      },
    },
  };
}

function createBreakthroughPill(): Consumable {
  return {
    id: 'pill-breakthrough',
    name: '护婴丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '护持识海，助力破境。',
    spec: {
      kind: 'pill',
      family: 'breakthrough',
      operations: [
        { type: 'add_status', status: 'clear_mind', usesRemaining: 1 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['静神芝'],
        analysisVersion: 2,
        propertyVector: [{ key: 'clear_mind_support', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '水',
        stability: 74,
        toxicityRating: 10,
        tags: ['breakthrough'],
        breakthroughTargetRealm: '元婴',
        breakthroughLabel: '护婴丹',
      },
    },
  };
}

function createTemperingPill(): Consumable {
  return {
    id: 'pill-tempering',
    name: '淬体丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '锤炼肉身。',
    spec: {
      kind: 'pill',
      family: 'tempering',
      operations: [
        { type: 'advance_track', track: 'tempering.vitality', value: 1 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'long_term',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['铁骨藤'],
        analysisVersion: 2,
        propertyVector: [{ key: 'tempering_vitality', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '土',
        stability: 68,
        toxicityRating: 12,
        tags: ['tempering_vitality'],
      },
    },
  };
}

describe('PillOperationExecutor', () => {
  it('restores percent-based hp from max hp instead of filling to full', () => {
    const cultivator = createCultivator();
    const { maxHp } = ConditionService.getMaxResources(cultivator);
    const now = new Date('2026-05-25T12:00:00.000Z');
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator, undefined, now),
      resources: {
        hp: { current: 1 },
        mp: { current: 100 },
      },
      timestamps: {
        lastRecoveryAt: now.toISOString(),
      },
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createHealingPill(),
      now,
    );

    expect(result.cultivator.condition?.resources.hp.current).toBe(
      1 + Math.floor(maxHp * 0.2),
    );
    expect(result.cultivator.condition?.resources.hp.current).toBeLessThan(maxHp);
  });

  it('applies cultivation pills to cultivation progress and independent quota counters', () => {
    const cultivator = createCultivator();
    cultivator.cultivation_progress = {
      cultivation_exp: 12,
      exp_cap: 100,
      comprehension_insight: 30,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createCultivationPill(),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.cultivation_progress?.cultivation_exp).toBe(60);
    expect(
      result.cultivator.condition?.counters.cultivationPillUsesByRealm.筑基,
    ).toBe(1);
    expect(
      result.cultivator.condition?.counters.longTermPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('rejects cultivation pills above the current realm quality tolerance without mutating state', () => {
    const cultivator = createCultivator();
    cultivator.cultivation_progress = {
      cultivation_exp: 12,
      exp_cap: 100,
      comprehension_insight: 30,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    };
    cultivator.condition = ConditionService.normalizeCondition(cultivator);
    const pill = {
      ...createCultivationPill(),
      quality: '真品',
    } satisfies Consumable;

    expect(() =>
      PillOperationExecutor.execute(
        cultivator,
        pill,
        new Date('2026-05-25T12:00:00.000Z'),
      ),
    ).toThrow('药力过盛，强行服用恐爆体而亡');

    expect(cultivator.cultivation_progress.cultivation_exp).toBe(12);
    expect(
      cultivator.condition.counters.cultivationPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('caps insight gain at 100 without consuming any quota entry', () => {
    const cultivator = createCultivator();
    cultivator.cultivation_progress = {
      cultivation_exp: 20,
      exp_cap: 100,
      comprehension_insight: 95,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createInsightPill(),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.cultivation_progress?.comprehension_insight).toBe(100);
    expect(
      result.cultivator.condition?.counters.cultivationPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
    expect(
      result.cultivator.condition?.counters.longTermPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('does not consume long-term quota entries for breakthrough pills', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      counters: {
        longTermPillUsesByRealm: {
          筑基: 3,
        },
        cultivationPillUsesByRealm: {},
      },
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createBreakthroughPill(),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(
      result.cultivator.condition?.counters.longTermPillUsesByRealm.筑基,
    ).toBe(3);
    expect(
      result.cultivator.condition?.statuses.some(
        (status) => status.key === 'clear_mind',
      ),
    ).toBe(true);
  });

  it('levels up tempering tracks and applies the matching attribute reward', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 99 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createTemperingPill(),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.attributes.vitality).toBe(41);
    expect(result.cultivator.condition?.tracks.tempering.vitality).toEqual({
      level: 1,
      progress: 0,
    });
    expect(result.trackLevelUps).toEqual([
      { track: 'tempering.vitality', newLevel: 1 },
    ]);
  });
});
