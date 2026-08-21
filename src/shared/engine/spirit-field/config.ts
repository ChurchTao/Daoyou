import type { Quality, RealmType } from '@shared/types/constants';

export const SPIRIT_FIELD_LEVELS = [
  { name: '凡田', upgradeCost: 0, speedBonus: 0 },
  { name: '灵田初级', upgradeCost: 10_000, speedBonus: 0.1 },
  { name: '灵田中级', upgradeCost: 50_000, speedBonus: 0.3 },
  { name: '灵田高级', upgradeCost: 300_000, speedBonus: 0.6 },
  { name: '药园初级', upgradeCost: 1_000_000, speedBonus: 1 },
  { name: '药园中级', upgradeCost: 3_000_000, speedBonus: 1.5 },
  { name: '药园高级', upgradeCost: 5_000_000, speedBonus: 2 },
] as const;

export const SPIRIT_FIELD_PLOT_UNLOCKS: ReadonlyArray<{
  index: number;
  minRealm: RealmType;
  minHarvest: number;
}> = [
  { index: 0, minRealm: '炼气', minHarvest: 0 },
  { index: 1, minRealm: '筑基', minHarvest: 50 },
  { index: 2, minRealm: '金丹', minHarvest: 100 },
  { index: 3, minRealm: '元婴', minHarvest: 300 },
  { index: 4, minRealm: '化神', minHarvest: 500 },
  { index: 5, minRealm: '炼虚', minHarvest: 1000 },
];

/**
 * 这里仅保存“品质级别”的经济/时间平衡，不保存具体灵植目录。
 * 具体灵植身份由独立 SpiritSeedGenerator + spirit-seed-generation Prompt 生成；
 * 不依赖 MaterialGenerator。
 */

/**
 * 灵种自己的品质权重。暂时与材料大盘接近，但独立维护，后续可以单独做灵种稀有度调优。
 * 市场传入 rankRange 时会先限制到市场层级范围，再按该权重抽取。
 */
export const SPIRIT_SEED_QUALITY_CHANCE_MAP: Record<Quality, number> = {
  凡品: 0.3,
  灵品: 0.3,
  玄品: 0.2,
  真品: 0.1,
  地品: 0.04,
  天品: 0.03,
  仙品: 0.02,
  神品: 0.01,
};

export const SPIRIT_FIELD_QUALITY_BALANCE: Record<
  Quality,
  {
    minRealm: RealmType;
    growthMs: number;
    careSlots: number;
    careCooldownMs: number;
    baseYield: readonly [number, number];
  }
> = {
  凡品: {
    minRealm: '炼气',
    growthMs: 12 * 60_000,
    careSlots: 1,
    careCooldownMs: 3 * 60_000,
    baseYield: [4, 6],
  },
  灵品: {
    minRealm: '筑基',
    growthMs: 30 * 60_000,
    careSlots: 2,
    careCooldownMs: 5 * 60_000,
    baseYield: [4, 5],
  },
  玄品: {
    minRealm: '金丹',
    growthMs: 90 * 60_000,
    careSlots: 3,
    careCooldownMs: 10 * 60_000,
    baseYield: [3, 5],
  },
  真品: {
    minRealm: '元婴',
    growthMs: 3 * 60 * 60_000,
    careSlots: 4,
    careCooldownMs: 15 * 60_000,
    baseYield: [3, 4],
  },
  地品: {
    minRealm: '化神',
    growthMs: 6 * 60 * 60_000,
    careSlots: 5,
    careCooldownMs: 20 * 60_000,
    baseYield: [2, 4],
  },
  天品: {
    minRealm: '炼虚',
    growthMs: 12 * 60 * 60_000,
    careSlots: 6,
    careCooldownMs: 30 * 60_000,
    baseYield: [2, 3],
  },
  仙品: {
    minRealm: '合体',
    growthMs: 24 * 60 * 60_000,
    careSlots: 7,
    careCooldownMs: 45 * 60_000,
    baseYield: [2, 3],
  },
  神品: {
    minRealm: '大乘',
    growthMs: 48 * 60 * 60_000,
    careSlots: 8,
    careCooldownMs: 60 * 60_000,
    baseYield: [1, 2],
  },
};

/** 新手只固定“品质与数量”，不再固定具体灵植。 */
export const SPIRIT_FIELD_STARTER_BATCHES = [
  { rank: '凡品', quantity: 5 },
  { rank: '灵品', quantity: 2 },
] as const satisfies ReadonlyArray<{ rank: Quality; quantity: number }>;

export function getSpiritFieldQualityBalance(quality: Quality) {
  return SPIRIT_FIELD_QUALITY_BALANCE[quality];
}
