import { describe, expect, it } from 'vitest';
import { ConditionService } from './ConditionService';
import { PillOperationExecutor } from './PillOperationExecutor';
import type { Consumable, Cultivator } from '@shared/types/cultivator';
import type { PillSpec } from '@shared/types/consumable';
import { BODY_CULTIVATION_TOTAL_PILL_USAGE_LIMIT } from '@shared/config/consumableSystem';

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

function createCultivationBoostPill(
  boostPercent: number,
  id = 'pill-cultivation-boost',
): Consumable {
  return {
    id,
    name: '养元丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    description: '养元蓄气。',
    spec: {
      kind: 'pill',
      family: 'cultivation',
      operations: [
        {
          type: 'add_status',
          status: 'cultivation_boost',
          usesRemaining: 1,
          payload: {
            boostPercent,
            retreatExpMultiplier: 1 + boostPercent,
          },
        },
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

function createBreakthroughStatusPill(
  status: 'breakthrough_focus' | 'protect_meridians' | 'clear_mind',
  payload: Record<string, number | string | boolean> = {},
  usesRemaining = 1,
  id = `pill-${status}`,
): Consumable {
  return {
    id,
    name: '破境丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '助力破境。',
    spec: {
      kind: 'pill',
      family: 'breakthrough',
      operations: [
        {
          type: 'add_status',
          status,
          usesRemaining,
          payload,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['静神芝'],
        analysisVersion: 2,
        propertyVector: [{ key: 'breakthrough_support', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '水',
        stability: 74,
        toxicityRating: 10,
        tags: ['breakthrough'],
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
        { type: 'advance_track', track: 'body.qi_blood', value: 1 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'long_term',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['铁骨藤'],
        analysisVersion: 2,
        propertyVector: [{ key: 'body_qi_blood', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '土',
        stability: 68,
        toxicityRating: 12,
        tags: ['body_qi_blood'],
      },
    },
  };
}

function createLongevityPill(): Consumable {
  return {
    id: 'pill-longevity',
    name: '延寿丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '固本延寿。',
    spec: {
      kind: 'pill',
      family: 'longevity',
      operations: [
        { type: 'increase_lifespan', value: 48 },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'longevity',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['寿元果'],
        analysisVersion: 2,
        propertyVector: [{ key: 'extend_lifespan', weight: 1 }],
        sourceMaterialVectors: [],
        dominantElement: '木',
        stability: 76,
        toxicityRating: 18,
        tags: ['extend_lifespan', 'longevity'],
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

  it('keeps historical direct cultivation pills working without consuming quota counters', () => {
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
      result.cultivator.condition?.counters.cultivationPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
    expect(
      result.cultivator.condition?.counters.longTermPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('adds cultivation boost status for new cultivation pills', () => {
    const cultivator = createCultivator();

    const result = PillOperationExecutor.execute(
      cultivator,
      createCultivationBoostPill(0.5),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.condition?.statuses).toContainEqual(
      expect.objectContaining({
        key: 'cultivation_boost',
        source: 'pill',
        usesRemaining: 1,
        payload: {
          boostPercent: 0.5,
          retreatExpMultiplier: 1.5,
        },
      }),
    );
    expect(
      result.cultivator.condition?.counters.cultivationPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('keeps the strongest cultivation boost when weaker pills are consumed later', () => {
    const cultivator = createCultivator();
    const now = new Date('2026-05-25T12:00:00.000Z');
    const strong = PillOperationExecutor.execute(
      cultivator,
      createCultivationBoostPill(1.2, 'strong-pill'),
      now,
    );

    const weak = PillOperationExecutor.execute(
      strong.cultivator,
      createCultivationBoostPill(0.5, 'weak-pill'),
      now,
    );

    const boosts =
      weak.cultivator.condition?.statuses.filter(
        (status) => status.key === 'cultivation_boost',
      ) ?? [];
    expect(boosts).toHaveLength(1);
    expect(boosts[0]?.payload).toEqual({
      boostPercent: 1.2,
      retreatExpMultiplier: 2.2,
    });
    expect(
      weak.cultivator.condition?.counters.cultivationPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('rejects cultivation pills above the current realm quality tolerance without consuming quota', () => {
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
      quality: '地品',
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
        longevityPillUsesByRealm: {},
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

  it('clear mind pills remove existing inner demon and keep the highest breakthrough uses', () => {
    const cultivator = createCultivator();
    cultivator.cultivation_progress = {
      cultivation_exp: 80,
      exp_cap: 100,
      comprehension_insight: 30,
      breakthrough_failures: 2,
      bottleneck_state: true,
      inner_demon: true,
      deviation_risk: 40,
    };
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      statuses: [
        {
          key: 'clear_mind',
          stacks: 1,
          source: 'pill',
          duration: { kind: 'until_removed' },
          usesRemaining: 2,
          payload: { preventsInnerDemon: true },
          createdAt: '2026-05-25T10:00:00.000Z',
          updatedAt: '2026-05-25T10:00:00.000Z',
        },
      ],
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createBreakthroughStatusPill(
        'clear_mind',
        { preventsInnerDemon: true },
        3,
      ),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.cultivation_progress?.inner_demon).toBe(false);
    expect(
      result.cultivator.condition?.statuses.find(
        (status) => status.key === 'clear_mind',
      )?.usesRemaining,
    ).toBe(3);
  });

  it('keeps stronger breakthrough payload statuses when weaker pills are consumed', () => {
    const cultivator = createCultivator();
    const now = new Date('2026-05-25T12:00:00.000Z');

    const strong = PillOperationExecutor.execute(
      cultivator,
      createBreakthroughStatusPill(
        'protect_meridians',
        { failureExpLossReductionPercent: 0.7 },
        1,
        'strong-protect',
      ),
      now,
    );
    const weak = PillOperationExecutor.execute(
      strong.cultivator,
      createBreakthroughStatusPill(
        'protect_meridians',
        { failureExpLossReductionPercent: 0.2 },
        1,
        'weak-protect',
      ),
      now,
    );

    expect(
      weak.cultivator.condition?.statuses.find(
        (status) => status.key === 'protect_meridians',
      )?.payload,
    ).toEqual({ failureExpLossReductionPercent: 0.7 });
  });

  it('applies longevity pills to lifespan and an isolated longevity quota counter', () => {
    const cultivator = createCultivator();

    const result = PillOperationExecutor.execute(
      cultivator,
      createLongevityPill(),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.lifespan).toBe(228);
    expect(
      result.cultivator.condition?.counters.longevityPillUsesByRealm.筑基,
    ).toBe(1);
    expect(
      result.cultivator.condition?.counters.longTermPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
    expect(
      result.cultivator.condition?.counters.cultivationPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('rejects non-cultivation pills above the current realm quality tolerance', () => {
    const cultivator = createCultivator();
    cultivator.condition = ConditionService.normalizeCondition(cultivator);
    const pill = {
      ...createLongevityPill(),
      quality: '地品',
    } satisfies Consumable;

    expect(() =>
      PillOperationExecutor.execute(
        cultivator,
        pill,
        new Date('2026-05-25T12:00:00.000Z'),
      ),
    ).toThrow('当前境界最多可承受真品丹药');

    expect(cultivator.lifespan).toBe(180);
    expect(
      cultivator.condition.counters.longevityPillUsesByRealm.筑基 ?? 0,
    ).toBe(0);
  });

  it('rejects longevity pills at their isolated quota limit without mutating lifespan', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      counters: {
        longTermPillUsesByRealm: {
          筑基: 7,
        },
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {
          筑基: 8,
        },
      },
    };

    expect(() =>
      PillOperationExecutor.execute(
        cultivator,
        createLongevityPill(),
        new Date('2026-05-25T12:00:00.000Z'),
      ),
    ).toThrow('该寿元丹服用次数已达上限');

    expect(cultivator.lifespan).toBe(180);
    expect(cultivator.condition.counters.longTermPillUsesByRealm.筑基).toBe(7);
    expect(cultivator.condition.counters.longevityPillUsesByRealm.筑基).toBe(8);
  });

  it('levels up body cultivation tracks without mutating base attributes', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      tracks: {
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 0, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 0, progress: 99 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
        tempering: {
          vitality: { level: 0, progress: 0 },
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

    expect(result.cultivator.attributes.vitality).toBe(40);
    expect(result.cultivator.condition?.tracks.bodyCultivation?.tracks.qi_blood).toEqual({
      level: 1,
      progress: 0,
    });
    expect(result.trackLevelUps).toEqual([
      { track: 'body.qi_blood', newLevel: 1 },
    ]);
  });

  it('allows legacy body cultivation pills at the old long-term quota limit', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      counters: {
        longTermPillUsesByRealm: {
          筑基: 8,
        },
        cultivationPillUsesByRealm: {
          筑基: 8,
        },
        longevityPillUsesByRealm: {},
        bodyCultivationPillUses: 3,
      },
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      createTemperingPill(),
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(
      result.cultivator.condition?.counters.longTermPillUsesByRealm.筑基,
    ).toBe(8);
    expect(
      result.cultivator.condition?.counters.bodyCultivationPillUses,
    ).toBe(4);
    expect(
      result.cultivator.condition?.tracks.bodyCultivation?.tracks.qi_blood.progress,
    ).toBe(1);
  });

  it('rejects body cultivation pills at the total body pill limit', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {},
        bodyCultivationPillUses: BODY_CULTIVATION_TOTAL_PILL_USAGE_LIMIT,
      },
    };

    expect(() =>
      PillOperationExecutor.execute(
        cultivator,
        createTemperingPill(),
        new Date('2026-05-25T12:00:00.000Z'),
      ),
    ).toThrow('炼体丹服用总数已达上限');

    expect(cultivator.condition.counters.bodyCultivationPillUses).toBe(
      BODY_CULTIVATION_TOTAL_PILL_USAGE_LIMIT,
    );
  });

  it('reduces body cultivation progress after the current realm soft cap', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      tracks: {
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 0, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 5, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
    };
    const basePill = createTemperingPill();
    const baseSpec = basePill.spec as PillSpec;
    const pill: Consumable = {
      ...basePill,
      id: 'pill-tempering-soft-cap',
      spec: {
        ...baseSpec,
        operations: [
          { type: 'advance_track', track: 'body.qi_blood', value: 20 },
        ],
      },
    };

    const result = PillOperationExecutor.execute(
      cultivator,
      pill,
      new Date('2026-05-25T12:00:00.000Z'),
    );

    expect(result.cultivator.condition?.tracks.bodyCultivation?.tracks.qi_blood).toEqual({
      level: 5,
      progress: 10,
    });
  });
});
