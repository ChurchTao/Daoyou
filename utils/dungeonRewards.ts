/**
 * 副本奖励系统配置
 * 定义奖励评级、物品池、品质加成等常量
 */

import type { MaterialType, Quality } from '../types/constants';

/**
 * 奖励评级配置
 * 根据副本表现评级（S/A/B/C/D）决定奖励数量和品质
 */
export const REWARD_TIER_CONFIG = {
  S: {
    consumableCount: { min: 3, max: 5 },
    artifactCount: { min: 2, max: 3 },
    qualityBonus: 2, // 品质加成等级
    spiritStoneMultiplier: 2.0, // 灵石倍率
  },
  A: {
    consumableCount: { min: 2, max: 4 },
    artifactCount: { min: 1, max: 2 },
    qualityBonus: 1,
    spiritStoneMultiplier: 1.5,
  },
  B: {
    consumableCount: { min: 1, max: 3 },
    artifactCount: { min: 0, max: 1 },
    qualityBonus: 0,
    spiritStoneMultiplier: 1.0,
  },
  C: {
    consumableCount: { min: 1, max: 2 },
    artifactCount: { min: 0, max: 1 },
    qualityBonus: -1,
    spiritStoneMultiplier: 0.7,
  },
  D: {
    consumableCount: { min: 0, max: 1 },
    artifactCount: { min: 0, max: 0 },
    qualityBonus: -2,
    spiritStoneMultiplier: 0.5,
  },
} as const;

/**
 * 消耗品池配置
 * 按境界分类的消耗品模板，用于生成随机奖励
 * 注意：type字段统一为'丹药'以符合schema定义，baseEffect存储效果类型
 */
export const CONSUMABLE_POOLS = {
  炼气期: [
    {
      name: '回春丹',
      type: '丹药' as const,
      description: '恢复50点生命值的基础丹药',
      baseEffect: { type: 'healing', hp: 50 },
      basePrice: 10,
    },
    {
      name: '聚灵丹',
      type: '丹药' as const,
      description: '恢复30点法力的基础丹药',
      baseEffect: { type: 'mana', mp: 30 },
      basePrice: 8,
    },
    {
      name: '辟谷丸',
      type: '丹药' as const,
      description: '可替代三日食物的丹药',
      baseEffect: { type: 'sustenance', satiety: 72 },
      basePrice: 5,
    },
    {
      name: '解毒散',
      type: '丹药' as const,
      description: '解除轻度毒素',
      baseEffect: { type: 'detox', removeToxin: 'minor' },
      basePrice: 12,
    },
  ],
  筑基期: [
    {
      name: '大回春丹',
      type: '丹药' as const,
      description: '恢复150点生命值的中级丹药',
      baseEffect: { type: 'healing', hp: 150 },
      basePrice: 30,
    },
    {
      name: '大聚灵丹',
      type: '丹药' as const,
      description: '恢复100点法力的中级丹药',
      baseEffect: { type: 'mana', mp: 100 },
      basePrice: 25,
    },
    {
      name: '凝神丹',
      type: '丹药' as const,
      description: '提升10%法术威力，持续1小时',
      baseEffect: { type: 'focus', spellPowerBonus: 0.1, duration: 3600 },
      basePrice: 40,
    },
    {
      name: '金刚丸',
      type: '丹药' as const,
      description: '提升20点防御，持续1小时',
      baseEffect: { type: 'defense', defenseBonus: 20, duration: 3600 },
      basePrice: 35,
    },
  ],
  金丹期: [
    {
      name: '极品回春丹',
      type: '丹药' as const,
      description: '恢复500点生命值的高级丹药',
      baseEffect: { type: 'healing', hp: 500 },
      basePrice: 100,
    },
    {
      name: '极品聚灵丹',
      type: '丹药' as const,
      description: '恢复300点法力的高级丹药',
      baseEffect: { type: 'mana', mp: 300 },
      basePrice: 80,
    },
    {
      name: '破境丹',
      type: '丹药' as const,
      description: '增加5%突破几率的珍贵丹药',
      baseEffect: { type: 'breakthrough', breakthroughChance: 0.05 },
      basePrice: 500,
    },
    {
      name: '天罡护体丹',
      type: '丹药' as const,
      description: '免疫一次致命伤害',
      baseEffect: { type: 'protection', deathProtection: 1 },
      basePrice: 300,
    },
  ],
  元婴期: [
    {
      name: '仙品回春丹',
      type: '丹药' as const,
      description: '恢复2000点生命值的顶级丹药',
      baseEffect: { type: 'healing', hp: 2000 },
      basePrice: 500,
    },
    {
      name: '仙品聚灵丹',
      type: '丹药' as const,
      description: '恢复1000点法力的顶级丹药',
      baseEffect: { type: 'mana', mp: 1000 },
      basePrice: 400,
    },
    {
      name: '涅槃重生丹',
      type: '丹药' as const,
      description: '死亡时自动复活并恢复50%生命',
      baseEffect: { type: 'rebirth', autoRevive: true, reviveHpPercent: 0.5 },
      basePrice: 2000,
    },
  ],
  化神期: [
    {
      name: '九转还魂丹',
      type: '丹药' as const,
      description: '瞬间恢复全部生命值',
      baseEffect: { type: 'healing', hpPercent: 1.0 },
      basePrice: 5000,
    },
    {
      name: '天地灵丹',
      type: '丹药' as const,
      description: '瞬间恢复全部法力',
      baseEffect: { type: 'mana', mpPercent: 1.0 },
      basePrice: 4000,
    },
    {
      name: '化神至宝丹',
      type: '丹药' as const,
      description: '全属性提升20%，持续24小时',
      baseEffect: {
        type: 'transcendence',
        allStatsBonus: 0.2,
        duration: 86400,
      },
      basePrice: 10000,
    },
  ],
} as const;

/**
 * 品质属性加成配置
 * 使用constants.ts中定义的Quality类型（凡品/灵品/玄品/真品/地品/天品/仙品/神品）
 */
export const QUALITY_ATTRIBUTE_BONUS: Record<
  Quality,
  { multiplier: number; priceMultiplier: number; color: string }
> = {
  凡品: {
    multiplier: 1.0,
    priceMultiplier: 1.0,
    color: 'white',
  },
  灵品: {
    multiplier: 1.3,
    priceMultiplier: 1.5,
    color: 'green',
  },
  玄品: {
    multiplier: 1.6,
    priceMultiplier: 2.5,
    color: 'blue',
  },
  真品: {
    multiplier: 2.0,
    priceMultiplier: 4.0,
    color: 'purple',
  },
  地品: {
    multiplier: 2.5,
    priceMultiplier: 6.0,
    color: 'orange',
  },
  天品: {
    multiplier: 3.2,
    priceMultiplier: 10.0,
    color: 'red',
  },
  仙品: {
    multiplier: 4.0,
    priceMultiplier: 20.0,
    color: 'gold',
  },
  神品: {
    multiplier: 5.0,
    priceMultiplier: 50.0,
    color: 'rainbow',
  },
} as const;

/**
 * 境界对应的灵石基础奖励
 */
export const REALM_SPIRIT_STONE_BASE = {
  炼气期: { min: 10, max: 30 },
  筑基期: { min: 50, max: 100 },
  金丹期: { min: 200, max: 400 },
  元婴期: { min: 1000, max: 2000 },
  化神期: { min: 5000, max: 10000 },
} as const;

/**
 * 法器类型定义（对齐schema.ts中artifacts表的slot字段）
 */
export const ARTIFACT_TYPES = [
  'weapon', // 武器
  'armor', // 防具
  'accessory', // 饰品
] as const;

/**
 * 材料池配置（对齐schema.ts中materials表）
 * 按境界分类的材料模板
 */
export const MATERIAL_POOLS = {
  炼气期: [
    {
      name: '青灵草',
      type: 'herb' as MaterialType,
      rank: '凡品' as Quality,
      element: '木',
      description: '最基础的灵草，用于炼制低阶丹药',
      basePrice: 5,
    },
    {
      name: '赤铜矿',
      type: 'ore' as MaterialType,
      rank: '凡品' as Quality,
      element: '金',
      description: '炼器的基础矿石',
      basePrice: 8,
    },
    {
      name: '妖兽皮',
      type: 'monster' as MaterialType,
      rank: '凡品' as Quality,
      element: null,
      description: '低阶妖兽的皮毛，用于制作护甲',
      basePrice: 10,
    },
  ],
  筑基期: [
    {
      name: '紫雾芝',
      type: 'herb' as MaterialType,
      rank: '灵品' as Quality,
      element: '木',
      description: '中阶灵药，药力醇厚',
      basePrice: 30,
    },
    {
      name: '寒铁精',
      type: 'ore' as MaterialType,
      rank: '灵品' as Quality,
      element: '水',
      description: '含有寒气的灵铁，炼器佳材',
      basePrice: 50,
    },
    {
      name: '妖丹碎片',
      type: 'monster' as MaterialType,
      rank: '灵品' as Quality,
      element: null,
      description: '筑基期妖兽的妖丹碎片',
      basePrice: 80,
    },
  ],
  金丹期: [
    {
      name: '千年雪莲',
      type: 'herb' as MaterialType,
      rank: '玄品' as Quality,
      element: '水',
      description: '千年灵药，药力强劲',
      basePrice: 200,
    },
    {
      name: '玄铁精华',
      type: 'ore' as MaterialType,
      rank: '玄品' as Quality,
      element: '金',
      description: '稀有的炼器材料',
      basePrice: 300,
    },
    {
      name: '完整妖丹',
      type: 'monster' as MaterialType,
      rank: '玄品' as Quality,
      element: null,
      description: '金丹期妖兽的完整妖丹',
      basePrice: 500,
    },
  ],
  元婴期: [
    {
      name: '七彩灵芝',
      type: 'herb' as MaterialType,
      rank: '真品' as Quality,
      element: null,
      description: '天地灵药，万年难遇',
      basePrice: 1000,
    },
    {
      name: '星辰精铁',
      type: 'ore' as MaterialType,
      rank: '真品' as Quality,
      element: '金',
      description: '天外陨铁，炼制法宝的顶级材料',
      basePrice: 1500,
    },
    {
      name: '元婴本源',
      type: 'monster' as MaterialType,
      rank: '真品' as Quality,
      element: null,
      description: '元婴期妖兽的元婴本源',
      basePrice: 2000,
    },
  ],
  化神期: [
    {
      name: '混沌灵根',
      type: 'herb' as MaterialType,
      rank: '地品' as Quality,
      element: null,
      description: '天地初开时诞生的灵根',
      basePrice: 5000,
    },
    {
      name: '道纹神金',
      type: 'ore' as MaterialType,
      rank: '地品' as Quality,
      element: null,
      description: '蕴含大道法则的神金',
      basePrice: 8000,
    },
    {
      name: '化神真髓',
      type: 'monster' as MaterialType,
      rank: '地品' as Quality,
      element: null,
      description: '化神期妖兽的真髓精华',
      basePrice: 10000,
    },
  ],
} as const;

/**
 * 类型导出
 */
export type RewardTier = keyof typeof REWARD_TIER_CONFIG;
export type RealmType = keyof typeof CONSUMABLE_POOLS;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * 辅助函数：根据评级和境界获取奖励配置
 */
export function getRewardConfig(tier: RewardTier, realm: RealmType) {
  return {
    tierConfig: REWARD_TIER_CONFIG[tier],
    consumablePool: CONSUMABLE_POOLS[realm],
    spiritStoneBase: REALM_SPIRIT_STONE_BASE[realm],
  };
}

/**
 * 辅助函数：计算品质加成后的属性值
 */
export function applyQualityBonus(
  baseEffect: Record<string, number>,
  quality: Quality,
): Record<string, number> {
  const multiplier = QUALITY_ATTRIBUTE_BONUS[quality].multiplier;
  const result: Record<string, number> = {};

  for (const key in baseEffect) {
    if (typeof baseEffect[key] === 'number') {
      result[key] = Math.floor(baseEffect[key] * multiplier);
    }
  }

  return result;
}

/**
 * 辅助函数：随机选择材料
 */
export function randomMaterial(realm: RealmType, count: number) {
  const pool = MATERIAL_POOLS[realm];
  const result = [];

  for (let i = 0; i < count; i++) {
    const item = pool[Math.floor(Math.random() * pool.length)];
    result.push(item);
  }

  return result;
}

/**
 * 辅助函数：随机选择消耗品
 */
export function randomConsumable(realm: RealmType, count: number) {
  const pool = CONSUMABLE_POOLS[realm];
  const result = [];

  for (let i = 0; i < count; i++) {
    const item = pool[Math.floor(Math.random() * pool.length)];
    result.push(item);
  }

  return result;
}
