import { describe, expect, it } from 'vitest';
import { ConditionService } from './ConditionService';
import { InnRecoveryService } from './InnRecoveryService';
import type { Cultivator } from '@shared/types/cultivator';

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
    spirit_stones: 10000,
    cultivation_progress: {
      cultivation_exp: 987,
      exp_cap: 1200,
      comprehension_insight: 42,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
  };
}

describe('InnRecoveryService', () => {
  it('restores hp/mp, clears statuses, preserves pill toxicity, and deducts cultivation exp', () => {
    const cultivator = createCultivator();
    const baseCondition = ConditionService.normalizeCondition(cultivator, {
      version: 1,
      resources: {
        hp: { current: 123 },
        mp: { current: 45 },
      },
      gauges: {
        pillToxicity: 88,
      },
      tracks: {
        tempering: {
          vitality: { level: 1, progress: 20 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {
          筑基: 2,
        },
        cultivationPillUsesByRealm: {},
      },
      statuses: [
        {
          key: 'minor_wound',
          stacks: 1,
          source: 'battle',
          duration: { kind: 'until_removed' },
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
        {
          key: 'clear_mind',
          stacks: 1,
          source: 'pill',
          duration: { kind: 'until_removed' },
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
      ],
      timestamps: {
        lastRecoveryAt: '2026-05-20T00:00:00.000Z',
      },
      metrics: {
        totalRecoveredHp: 10,
        totalRecoveredMp: 5,
      },
    });
    cultivator.condition = baseCondition;

    const result = InnRecoveryService.buildRecoveryResult(
      cultivator,
      new Date('2026-05-25T00:00:00.000Z'),
      () => 0,
    );
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);

    expect(result.nextCondition.resources.hp.current).toBe(maxHp);
    expect(result.nextCondition.resources.mp.current).toBe(maxMp);
    expect(result.nextCondition.statuses).toEqual([]);
    expect(result.nextCondition.gauges.pillToxicity).toBe(88);
    expect(result.nextCondition.counters.longTermPillUsesByRealm).toEqual({
      筑基: 2,
    });
    expect(result.spiritStoneCost).toBe(3000);
    expect(result.clearedStatusCount).toBe(2);
    expect(result.cultivationLossPercent).toBe(5);
    expect(result.cultivationLossAmount).toBe(Math.floor(987 * 0.05));
    expect(result.nextCultivationProgress.cultivation_exp).toBe(
      987 - Math.floor(987 * 0.05),
    );
  });

  it('allows zero cultivation loss when current cultivation exp is too low', () => {
    const cultivator = createCultivator();
    cultivator.cultivation_progress = {
      ...cultivator.cultivation_progress!,
      cultivation_exp: 3,
    };

    const result = InnRecoveryService.buildRecoveryResult(
      cultivator,
      new Date('2026-05-25T00:00:00.000Z'),
      () => 0.999,
    );

    expect(result.spiritStoneCost).toBe(3000);
    expect(result.cultivationLossPercent).toBe(10);
    expect(result.cultivationLossAmount).toBe(0);
    expect(result.nextCultivationProgress.cultivation_exp).toBe(3);
  });

  it('scales spirit stone cost by major realm from 2000 to 10000', () => {
    const lowRealmCultivator = createCultivator();
    lowRealmCultivator.realm = '炼气';

    const highRealmCultivator = createCultivator();
    highRealmCultivator.realm = '渡劫';

    expect(
      InnRecoveryService.buildRecoveryResult(
        lowRealmCultivator,
        new Date('2026-05-25T00:00:00.000Z'),
        () => 0,
      ).spiritStoneCost,
    ).toBe(2000);
    expect(
      InnRecoveryService.buildRecoveryResult(
        highRealmCultivator,
        new Date('2026-05-25T00:00:00.000Z'),
        () => 0,
      ).spiritStoneCost,
    ).toBe(10000);
  });

  it('adds multiple inn loss reductions together before applying the deduction', () => {
    const cultivator = createCultivator();
    cultivator.cultivation_progress = {
      ...cultivator.cultivation_progress!,
      cultivation_exp: 2000,
    };
    cultivator.pre_heaven_fates = [
      {
        name: '稳脉命',
        effects: [
          {
            id: 'inn-loss-a',
            effectId: 'inn-loss-reduction',
            scope: 'daily',
            polarity: 'boon',
            effectType: 'inn_cultivation_loss_multiplier',
            value: 0.85,
            label: '住店修为损耗 -15%',
            description: '住店修为损耗降低。',
            rollMeta: {
              qualityAnchor: '凡品',
              minValue: 0.85,
              maxValue: 0.85,
              rolledPercentile: 0.5,
              roundingStep: 0.01,
            },
          },
        ],
      },
      {
        name: '静骨命',
        effects: [
          {
            id: 'inn-loss-b',
            effectId: 'inn-loss-reduction',
            scope: 'daily',
            polarity: 'boon',
            effectType: 'inn_cultivation_loss_multiplier',
            value: 0.85,
            label: '住店修为损耗 -15%',
            description: '住店修为损耗降低。',
            rollMeta: {
              qualityAnchor: '凡品',
              minValue: 0.85,
              maxValue: 0.85,
              rolledPercentile: 0.5,
              roundingStep: 0.01,
            },
          },
        ],
      },
    ];

    const result = InnRecoveryService.buildRecoveryResult(
      cultivator,
      new Date('2026-05-25T00:00:00.000Z'),
      () => 0,
    );

    expect(result.cultivationLossPercent).toBe(5);
    expect(result.cultivationLossAmount).toBe(70);
    expect(result.nextCultivationProgress.cultivation_exp).toBe(1930);
  });

  it('applies fate-based inn loss reduction and system spirit stone surcharge', () => {
    const cultivator = createCultivator();
    cultivator.pre_heaven_fates = [
      {
        name: '丹心厚骨',
        effects: [
          {
            id: 'inn-loss',
            effectId: 'inn-loss-reduction',
            scope: 'daily',
            polarity: 'boon',
            effectType: 'inn_cultivation_loss_multiplier',
            value: 0.85,
            label: '住店修为损耗 -15%',
            description: '住店修为损耗降低。',
            rollMeta: {
              qualityAnchor: '凡品',
              minValue: 0.85,
              maxValue: 0.85,
              rolledPercentile: 0.5,
              roundingStep: 0.01,
            },
          },
          {
            id: 'system-surcharge',
            effectId: 'system-spirit-stone-surcharge',
            scope: 'drawback',
            polarity: 'burden',
            effectType: 'system_spirit_stone_multiplier',
            value: 1.08,
            label: '系统养成灵石消耗 +8%',
            description: '系统养成灵石消耗上升。',
            rollMeta: {
              qualityAnchor: '天品',
              minValue: 1.08,
              maxValue: 1.08,
              rolledPercentile: 0.5,
              roundingStep: 0.01,
            },
          },
        ],
      },
    ];

    const result = InnRecoveryService.buildRecoveryResult(
      cultivator,
      new Date('2026-05-25T00:00:00.000Z'),
      () => 0,
    );

    expect(result.spiritStoneCost).toBe(3240);
    expect(result.cultivationLossPercent).toBe(5);
    expect(result.cultivationLossAmount).toBe(42);
    expect(result.nextCultivationProgress.cultivation_exp).toBe(945);
  });
});
