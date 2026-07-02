import { describe, expect, it } from 'vitest';
import type { AlchemyRecipePlan } from '@shared/types/consumable';
import type { PreparedAlchemyMaterial } from './AlchemyRecipeRules';
import { synthesizeAlchemyFromPlan } from './AlchemyRecipeRules';

describe('AlchemyRecipeRules', () => {
  it('can synthesize a marrow-wash pill from marrow-wash property vectors', () => {
    const materials: PreparedAlchemyMaterial[] = [
      {
        id: 'wash-flower',
        materialRef: 'material:wash-flower',
        name: '洗髓花',
        type: 'herb',
        rank: '玄品',
        element: '木',
        dose: 1,
        description: '可伐脉易筋。',
      },
    ];
    const plan: AlchemyRecipePlan = {
      materialVectors: [
        {
          materialRef: 'material:wash-flower',
          materialName: '洗髓花',
          properties: [{ key: 'marrow_wash', weight: 1 }],
        },
      ],
      intentVector: [{ key: 'marrow_wash', weight: 1 }],
      focusMode: 'focused',
    };

    const result = synthesizeAlchemyFromPlan(materials, plan, '玄品', '筑基', {
      rng: () => 0.5,
    });

    expect(result.family).toBe('marrow_wash');
    expect(result.propertyVector).toEqual([{ key: 'marrow_wash', weight: 1 }]);
    expect(result.operations).toContainEqual({
      type: 'advance_track',
      track: 'marrow_wash',
      value: expect.any(Number),
    });
    expect(result.operations.some((operation) => operation.type === 'change_gauge')).toBe(
      true,
    );
  });
});
