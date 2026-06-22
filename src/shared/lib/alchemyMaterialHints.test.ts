import { describe, expect, it } from 'vitest';
import {
  inferAlchemyMaterialPropertyHints,
  mergeAlchemyMaterialPropertyHints,
} from './alchemyMaterialHints';

describe('alchemy material hints', () => {
  it('infers body cultivation properties from material names and descriptions', () => {
    expect(
      inferAlchemyMaterialPropertyHints({
        name: '雷击龙骨',
        description: '骨髓如汞，可强固筋骨。',
      }),
    ).toContainEqual({ key: 'body_sinew_bone', weight: 0.9 });

    expect(
      inferAlchemyMaterialPropertyHints({
        name: '魂晶',
        description: '晶中清光可定魂守住识海。',
      }),
    ).toEqual([
      { key: 'body_primordial_spirit', weight: 0.85 },
    ]);
  });

  it('merges body hints into existing LLM material vectors', () => {
    const vector = mergeAlchemyMaterialPropertyHints(
      {
        materialRef: 'material_1',
        materialName: '真火莲',
        properties: [{ key: 'restore_hp', weight: 1 }],
      },
      {
        name: '真火莲',
        description: '火气入脏腑，可煅五脏并提升爆发承载。',
      },
    );

    expect(vector.properties).toContainEqual({
      key: 'body_organs',
      weight: 0.4737,
    });
  });
});
