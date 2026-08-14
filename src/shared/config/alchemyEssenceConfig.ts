import type { Quality } from '@shared/types/constants';
import type { PillAppearanceGrade } from '@shared/types/consumable';

export const MATERIAL_ESSENCE_BY_QUALITY: Record<Quality, number> = {
  凡品: 8,
  灵品: 15,
  玄品: 40,
  真品: 80,
  地品: 190,
  天品: 520,
  仙品: 1550,
  神品: 5200,
};

export const MATERIAL_ESSENCE_TYPE_MULTIPLIER: Record<string, number> = {
  herb: 1,
  ore: 1,
  monster: 1.2,
  tcdb: 2.5,
  aux: 0.65,
};

export const PILL_UNIT_ESSENCE_BY_QUALITY: Record<Quality, number> = {
  凡品: 20,
  灵品: 35,
  玄品: 60,
  真品: 110,
  地品: 220,
  天品: 450,
  仙品: 900,
  神品: 1800,
};

export const PILL_CONDENSATION_MULTIPLIER_BY_QUALITY: Record<Quality, number> = {
  凡品: 1,
  灵品: 1.05,
  玄品: 1.15,
  真品: 1.35,
  地品: 1.7,
  天品: 2.2,
  仙品: 3.2,
  神品: 5,
};

export const PILL_APPEARANCE_EFFECT_MULTIPLIER: Record<
  PillAppearanceGrade,
  number
> = {
  low: 0.9,
  middle: 1,
  high: 1.1,
  perfect: 1.3,
};

export const MAX_ALCHEMY_OUTPUT_LOTS = 8;
export const MAX_ALCHEMY_OUTPUT_QUANTITY = 999;
export const MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER = 1.2;
