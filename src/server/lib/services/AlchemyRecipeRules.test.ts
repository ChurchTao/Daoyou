import { describe, expect, it } from 'vitest';
import {
  buildAlchemyBatchProfile,
  buildAlchemyBatchPreview,
  synthesizeAlchemyFromPlan,
  type PreparedAlchemyMaterial,
} from './AlchemyRecipeRules';
import type { AlchemyRecipePlan } from '@shared/types/consumable';

function material(
  overrides: Partial<PreparedAlchemyMaterial>,
): PreparedAlchemyMaterial {
  return {
    id: overrides.id ?? 'm1',
    materialRef: overrides.materialRef ?? 'material_1',
    name: overrides.name ?? '回春草',
    description: overrides.description ?? '补气回春，生肌疗伤。',
    rank: overrides.rank ?? '真品',
    element: overrides.element ?? '木',
    type: overrides.type ?? 'herb',
    dose: overrides.dose ?? 1,
  };
}

function plan(
  materialVectors: AlchemyRecipePlan['materialVectors'],
  focusMode: AlchemyRecipePlan['focusMode'] = 'balanced',
): AlchemyRecipePlan {
  return {
    materialVectors,
    intentVector: [{ key: 'restore_hp', weight: 1 }],
    focusMode,
    requestedElementBias: '木',
  };
}

describe('AlchemyRecipeRules batch profile', () => {
  it('keeps one single-dose material at one pill', () => {
    const result = synthesizeAlchemyFromPlan(
      [material({})],
      plan([
        {
          materialRef: 'material_1',
          materialName: '回春草',
          properties: [{ key: 'restore_hp', weight: 1 }],
        },
      ]),
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );

    expect(result.batchProfile).toMatchObject({
      yieldQuantity: 1,
      compoundTier: 'single',
    });
    expect(result.stability).toBeGreaterThan(60);
  });

  it('lets a high-dose single material increase yield without multi-material synergy', () => {
    const result = synthesizeAlchemyFromPlan(
      [material({ dose: 3 })],
      plan([
        {
          materialRef: 'material_1',
          materialName: '回春草',
          properties: [{ key: 'restore_hp', weight: 1 }],
        },
      ]),
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );

    expect(result.batchProfile.yieldQuantity).toBe(3);
    expect(result.batchProfile.compoundTier).toBe('single');
    expect(result.batchProfile.secondaryEffectMultiplierBonus).toBe(0);
  });

  it('rewards aligned multi-material batches without exceeding five pills', () => {
    const materials = Array.from({ length: 5 }, (_, index) =>
      material({
        id: `m${index + 1}`,
        materialRef: `material_${index + 1}`,
        name: `回春草${index + 1}`,
        rank: '真品',
      }),
    );
    const result = synthesizeAlchemyFromPlan(
      materials,
      plan(
        materials.map((item) => ({
          materialRef: item.materialRef,
          materialName: item.name,
          properties: [{ key: 'restore_hp', weight: 1 }],
        })),
      ),
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );

    expect(result.batchProfile.yieldQuantity).toBe(5);
    expect(result.batchProfile.compoundTier).toBe('synergy');
    expect(result.batchProfile.synergyScore).toBeGreaterThan(0.65);
  });

  it('penalizes scattered conflicting material routes', () => {
    const materials = [
      material({ id: 'm1', materialRef: 'material_1', name: '回春草' }),
      material({
        id: 'm2',
        materialRef: 'material_2',
        name: '烈毒兽晶',
        type: 'monster',
        element: '火',
      }),
      material({
        id: 'm3',
        materialRef: 'material_3',
        name: '清心玉露',
        element: '水',
      }),
    ];
    const result = synthesizeAlchemyFromPlan(
      materials,
      plan(
        [
          ['restore_hp', '回春草'],
          ['restore_mp', '烈毒兽晶'],
          ['insight', '清心玉露'],
        ].map(([key, name], index) => ({
          materialRef: `material_${index + 1}`,
          materialName: name,
          properties: [{ key: key as any, weight: 1 }],
        })),
        'risky',
      ),
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );

    expect(result.batchProfile.conflictScore).toBeGreaterThanOrEqual(0.65);
    expect(result.batchProfile.compoundTier).toBe('conflict');
    expect(result.batchProfile.yieldQuantity).toBeLessThan(3);
    expect(result.toxicityRating).toBeGreaterThan(20);
  });

  it('does not treat a low-quality filler as another high-quality pill batch', () => {
    const preview = buildAlchemyBatchPreview([
      material({ id: 'm1', materialRef: 'material_1', rank: '神品' }),
      material({
        id: 'm2',
        materialRef: 'material_2',
        name: '凡草',
        rank: '凡品',
      }),
    ]);

    expect(preview.minYield).toBe(1);
    expect(preview.maxYield).toBe(1);
  });

  it('does not let large amounts of low-quality filler duplicate high-quality pills', () => {
    const materials = [
      material({ id: 'm1', materialRef: 'material_1', rank: '神品' }),
      ...Array.from({ length: 4 }, (_, index) =>
        material({
          id: `filler_${index + 1}`,
          materialRef: `filler_${index + 1}`,
          name: `凡草${index + 1}`,
          rank: '凡品',
          dose: 5,
        }),
      ),
    ];
    const result = synthesizeAlchemyFromPlan(
      materials,
      plan(
        materials.map((item) => ({
          materialRef: item.materialRef,
          materialName: item.name,
          properties: [{ key: 'restore_hp', weight: 1 }],
        })),
      ),
      '神品',
      '筑基',
      { rng: () => 0.5 },
    );
    const preview = buildAlchemyBatchPreview(materials);

    expect(preview.minYield).toBe(1);
    expect(preview.maxYield).toBe(1);
    expect(result.batchProfile.yieldQuantity).toBe(1);
  });

  it('caps poor formula fit at two pills', () => {
    const materials = [
      material({ id: 'm1', materialRef: 'material_1' }),
      material({ id: 'm2', materialRef: 'material_2', name: '回春花' }),
      material({ id: 'm3', materialRef: 'material_3', name: '回春露' }),
    ];
    const result = synthesizeAlchemyFromPlan(
      materials,
      plan(
        materials.map((item) => ({
          materialRef: item.materialRef,
          materialName: item.name,
          properties: [{ key: 'restore_hp', weight: 1 }],
        })),
      ),
      '真品',
      '筑基',
      { rng: () => 0.5 },
    );
    const poorProfile = buildAlchemyBatchProfile(materials, result, {
      formulaFitBand: 'poor',
      formulaFitScore: 0,
    });

    expect(poorProfile.yieldQuantity).toBeLessThanOrEqual(2);
  });
});
