import type { ElementType, Quality } from '@daoyou/shared/types/constants';

export const ALCHEMY_ALLOWED_MATERIAL_TYPES = [
  'herb',
  'ore',
  'monster',
  'tcdb',
  'aux',
] as const;

export type AlchemyMaterialType =
  (typeof ALCHEMY_ALLOWED_MATERIAL_TYPES)[number];

export const POTENCY_BY_QUALITY: Record<Quality, number> = {
  凡品: 8,
  灵品: 12,
  玄品: 18,
  真品: 26,
  地品: 36,
  天品: 48,
  仙品: 64,
  神品: 84,
};

export const BASE_TOXICITY_BY_TYPE: Record<AlchemyMaterialType, number> = {
  herb: 2,
  ore: 4,
  monster: 8,
  tcdb: 6,
  aux: 1,
};

export const BASE_STABILITY_BY_TYPE: Record<AlchemyMaterialType, number> = {
  herb: 72,
  ore: 60,
  monster: 52,
  tcdb: 66,
  aux: 80,
};

export const QUALITY_STABILITY_BONUS: Record<Quality, number> = {
  凡品: 0,
  灵品: 4,
  玄品: 8,
  真品: 12,
  地品: 16,
  天品: 20,
  仙品: 24,
  神品: 28,
};

export const ELEMENT_PREFIX_MAP: Record<ElementType, string> = {
  金: '庚金',
  木: '青木',
  水: '玄水',
  火: '炎阳',
  土: '厚土',
  风: '罡风',
  雷: '惊雷',
  冰: '寒霜',
};
