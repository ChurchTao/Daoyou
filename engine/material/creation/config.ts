import type { MaterialType, Quality } from '@/types/constants';

// 每个品质出现的概率
export const QUALITY_CHANCE_MAP: Record<Quality, number> = {
  凡品: 0.3,
  灵品: 0.3,
  玄品: 0.2,
  真品: 0.1,
  地品: 0.04,
  天品: 0.03,
  仙品: 0.02,
  神品: 0.01,
};

// 随机生成时各类型出现的权重 (非固定生成时使用)
export const TYPE_CHANCE_MAP: Record<MaterialType, number> = {
  herb: 0.35, // 35% 灵药
  ore: 0.28, // 28% 矿石
  monster: 0.22, // 22% 妖兽材料
  tcdb: 0.07, // 7% 天材地宝
  aux: 0.05, // 5% 特殊辅料
  manual: 0.03, // 3% 功法典籍（稀有）
};

// 品质基础价格
export const BASE_PRICES: Record<Quality, number> = {
  凡品: 50,
  灵品: 300,
  玄品: 1000,
  真品: 3000,
  地品: 10000,
  天品: 50000,
  仙品: 200000,
  神品: 1000000,
};

// 类型价格倍率
export const TYPE_MULTIPLIERS: Record<MaterialType, number> = {
  herb: 1.0,
  ore: 1.0,
  monster: 1.2,
  tcdb: 2.5, // 天材地宝
  aux: 1.5,
  manual: 3.0, // 典籍
};

// 类型中文描述与解释（用于 Prompt）
export const TYPE_DESCRIPTIONS: Record<MaterialType, string> = {
  herb: '药材 (用于炼丹，如灵草、灵果)',
  ore: '矿石 (用于炼器，如金属、晶石)',
  monster: '妖兽材料 (妖丹、骨骼、皮毛等)',
  tcdb: '天材地宝 (稀世奇珍，蕴含天地法则)',
  aux: '辅料 (炼丹/炼器的辅助材料，如灵液、粉尘)',
  manual: '功法典籍 (玉简、残页，记载功法神通)',
};

// 各品质的堆叠数量配置 [min, max]
export const QUANTITY_RANGE_MAP: Record<Quality, [number, number]> = {
  凡品: [2, 5],
  灵品: [1, 3],
  玄品: [1, 1],
  真品: [1, 1],
  地品: [1, 1],
  天品: [1, 1],
  仙品: [1, 1],
  神品: [1, 1],
};

// 品质到数字等级的映射
export const QUALITY_TO_RANK: Record<Quality, number> = {
  凡品: 1,
  灵品: 2,
  玄品: 3,
  真品: 4,
  地品: 5,
  天品: 6,
  仙品: 7,
  神品: 8,
};

// 数字等级到品质的映射
export const RANK_TO_QUALITY: Record<number, Quality> = {
  1: '凡品',
  2: '灵品',
  3: '玄品',
  4: '真品',
  5: '地品',
  6: '天品',
  7: '仙品',
  8: '神品',
};
