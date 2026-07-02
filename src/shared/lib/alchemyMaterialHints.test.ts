import { describe, expect, it } from 'vitest';
import { inferAlchemyMaterialPropertyHints } from './alchemyMaterialHints';

describe('inferAlchemyMaterialPropertyHints', () => {
  it('recognizes marrow-wash material keywords', () => {
    expect(
      inferAlchemyMaterialPropertyHints({
        name: '洗髓花',
        description: '可伐脉易筋，洗去根骨杂质。',
      }),
    ).toEqual([{ key: 'marrow_wash', weight: 0.92 }]);
  });

  it('keeps plain bone marrow materials on the body sinew-bone route', () => {
    const hints = inferAlchemyMaterialPropertyHints({
      name: '妖兽骨髓',
      description: '骨髓沉重，适合锻骨强筋。',
    });

    expect(hints[0]).toEqual({ key: 'body_sinew_bone', weight: 0.9 });
  });
});
