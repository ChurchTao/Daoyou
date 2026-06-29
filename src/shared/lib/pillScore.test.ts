import type { PillAlchemyMeta, PillSpec } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
import { calculatePillScore, formatPillScore } from './pillScore';

function baseMeta(overrides: Partial<PillAlchemyMeta> = {}): PillAlchemyMeta {
  return {
    source: 'improvised',
    sourceMaterials: ['赤阳草'],
    analysisVersion: 2,
    propertyVector: [{ key: 'restore_hp', weight: 1 }],
    sourceMaterialVectors: [],
    stability: 60,
    toxicityRating: 8,
    tags: ['healing'],
    ...overrides,
  } as PillAlchemyMeta;
}

function pill(
  spec: Partial<PillSpec>,
  overrides: Partial<Consumable> = {},
): Consumable {
  return {
    name: '测试丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    score: 0,
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'percent',
          value: 0.18,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: baseMeta(),
      ...spec,
    },
    ...overrides,
  };
}

describe('calculatePillScore', () => {
  it('separates same-quality pills by actual effect power', () => {
    const simple = pill({});
    const compound = pill({
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'percent',
          value: 0.18,
        },
        {
          type: 'restore_resource',
          resource: 'mp',
          mode: 'percent',
          value: 0.16,
        },
        { type: 'add_status', status: 'clear_mind', usesRemaining: 1 },
      ],
    });

    expect(calculatePillScore(compound)).toBeGreaterThan(
      calculatePillScore(simple)!,
    );
  });

  it('does not let score 0 override deterministic scoring', () => {
    const result = calculatePillScore(pill({}, { score: 0 }));

    expect(result).toBeGreaterThan(0);
  });

  it('rewards high stability, strong appearance, and synergistic batches', () => {
    const baseline = pill({});
    const refined = pill({
      alchemyMeta: baseMeta({
        stability: 86,
        toxicityRating: 2,
        appearance: 'perfect',
        batch: {
          yieldQuantity: 3,
          synergyScore: 0.9,
          conflictScore: 0.05,
          compoundTier: 'synergy',
          roleSummary: '主辅相合',
          stabilityDelta: 8,
          toxicityDelta: -4,
          secondaryEffectMultiplierBonus: 0.5,
        },
      }),
    });

    expect(calculatePillScore(refined)).toBeGreaterThan(
      calculatePillScore(baseline)!,
    );
  });

  it('penalizes high toxicity, conflict, and poor formula fit', () => {
    const baseline = pill({});
    const failedFormula = pill({
      alchemyMeta: {
        ...baseMeta({
          source: 'formula',
          formulaId: 'formula-1',
          fitScore: 0.32,
          fitBand: 'poor',
          fitMultiplier: 0.6,
          stability: 36,
          toxicityRating: 82,
          appearance: 'low',
          batch: {
            yieldQuantity: 1,
            synergyScore: 0.05,
            conflictScore: 0.9,
            compoundTier: 'conflict',
            roleSummary: '药路冲突',
            stabilityDelta: -10,
            toxicityDelta: 18,
            secondaryEffectMultiplierBonus: 0,
          },
        }),
      },
    });

    expect(calculatePillScore(failedFormula)).toBeLessThan(
      calculatePillScore(baseline)!,
    );
  });

  it('keeps quantity out of single-pill scoring', () => {
    const one = calculatePillScore(pill({}, { quantity: 1 }));
    const stack = calculatePillScore(pill({}, { quantity: 5 }));

    expect(stack).toBe(one);
  });

  it('formats score text consistently', () => {
    expect(formatPillScore(258.6)).toBe('评分 259');
  });
});
