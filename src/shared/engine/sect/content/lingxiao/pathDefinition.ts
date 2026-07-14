import type { SectMeridianNodeDefinition } from '../../types';

const LAYER_REQUIREMENTS = {
  1: { minRealm: '筑基', minRealmStage: '初期', minPathLevel: 5 },
  2: { minRealm: '筑基', minRealmStage: '圆满', minPathLevel: 15 },
  3: { minRealm: '金丹', minRealmStage: '圆满', minPathLevel: 30 },
  4: { minRealm: '元婴', minRealmStage: '圆满', minPathLevel: 50 },
  5: { minRealm: '化神', minRealmStage: '中期', minPathLevel: 70 },
  ultimate: { minRealm: '化神', minRealmStage: '圆满', minPathLevel: 100 },
} as const;

/** Applies the shared six-layer progression contract to a content node. */
export function defineLingxiaoNode(
  definition: Omit<
    SectMeridianNodeDefinition,
    'minRealm' | 'minRealmStage' | 'minPathLevel'
  >,
): SectMeridianNodeDefinition {
  return { ...definition, ...LAYER_REQUIREMENTS[definition.layer] };
}
