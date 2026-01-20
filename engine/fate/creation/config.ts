import type { Quality } from '@/types/constants';

/**
 * 每个品质出现的概率
 */
export const FATE_QUALITY_CHANCE_MAP: Record<Quality, number> = {
  凡品: 0.3,
  灵品: 0.3,
  玄品: 0.2,
  真品: 0.1,
  地品: 0.04,
  天品: 0.03,
  仙品: 0.02,
  神品: 0.01,
};

/**
 * 不同品质对应的词条数量建议
 * 这里通常由 FateAffixGenerator 内部逻辑决定，但在 Prompt 中提供给 AI 参考
 */
export const QUALITY_TO_EFFECT_COUNT_DESC: Record<Quality, number> = {
  凡品: 1,
  灵品: 2,
  玄品: 2,
  真品: 3,
  地品: 3,
  天品: 4,
  仙品: 4,
  神品: 5,
};
