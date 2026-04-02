import type { MaterialFingerprint } from '../../types';
import type { Quality } from '@/types/constants';
import type { MaterialType } from '../../analysis/types';

/**
 * 测试用 MaterialFingerprint 工厂函数。
 * 提供合理的默认值以减少测试样板代码。
 */
export function makeFingerprint(
  overrides: Partial<MaterialFingerprint> & { materialName?: string } = {},
): MaterialFingerprint {
  return {
    materialId: overrides.materialId ?? 'mat-default',
    materialName: overrides.materialName ?? '测试材料',
    materialType: (overrides.materialType ?? 'herb') as MaterialType,
    rank: (overrides.rank ?? '凡品') as Quality,
    quantity: overrides.quantity ?? 1,
    explicitTags: overrides.explicitTags ?? [],
    semanticTags: overrides.semanticTags ?? [],
    recipeTags: overrides.recipeTags ?? [],
    energyValue: overrides.energyValue ?? 10,
    rarityWeight: overrides.rarityWeight ?? 1,
    element: overrides.element,
  };
}
