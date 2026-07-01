import type { Quality } from '@shared/types/constants';

export const FATE_SLOT_COUNT = 3;
export const FATE_CANDIDATE_COUNT = 6;
export const FATE_RESHAPE_CANDIDATE_COUNT = 8;
export const FATE_REROLL_LIMIT = 5;
export const FATE_ROLL_VERSION = 'v6';

export const FATE_QUALITY_ORDER = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
] as const satisfies readonly Quality[];

export const FATE_QUALITY_SCALE: Record<Quality, number> = {
  凡品: 1,
  灵品: 1.3,
  玄品: 1.65,
  真品: 2,
  地品: 2.45,
  天品: 3,
  仙品: 3.7,
  神品: 4.5,
};

export const FATE_QUALITY_WEIGHTS: Record<Quality, number> = {
  凡品: 0.328,
  灵品: 0.235,
  玄品: 0.157,
  真品: 0.113,
  地品: 0.095,
  天品: 0.037,
  仙品: 0.023,
  神品: 0.012,
};

export const FATE_DUAL_SIDED_CHANCE: Partial<Record<Quality, number>> = {
  地品: 0.1,
  天品: 0.2,
  仙品: 0.3,
  神品: 0.45,
};
