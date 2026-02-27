/**
 * 副本奖励系统 - 境界配置表
 *
 * 定义每个境界的奖励数值范围和评级倍率
 */

import type { Quality, RealmType } from '@/types/constants';
import type { RewardRangeConfig, ValueRange } from './types';

/**
 * 境界 → 奖励数值范围配置
 */
export const REALM_REWARD_CONFIG: Record<RealmType, RewardRangeConfig> = {
  炼气: {
    spirit_stones: { min: 10, max: 50 },
    material_price: { min: 5, max: 30 },
    cultivation_exp: { min: 10, max: 50 },
    comprehension_insight: { min: 1, max: 5 },
  },
  筑基: {
    spirit_stones: { min: 50, max: 200 },
    material_price: { min: 20, max: 100 },
    cultivation_exp: { min: 30, max: 150 },
    comprehension_insight: { min: 3, max: 10 },
  },
  金丹: {
    spirit_stones: { min: 150, max: 600 },
    material_price: { min: 80, max: 400 },
    cultivation_exp: { min: 100, max: 500 },
    comprehension_insight: { min: 5, max: 15 },
  },
  元婴: {
    spirit_stones: { min: 400, max: 1500 },
    material_price: { min: 200, max: 1000 },
    cultivation_exp: { min: 300, max: 1200 },
    comprehension_insight: { min: 8, max: 20 },
  },
  化神: {
    spirit_stones: { min: 1000, max: 4000 },
    material_price: { min: 500, max: 2500 },
    cultivation_exp: { min: 800, max: 3000 },
    comprehension_insight: { min: 12, max: 30 },
  },
  炼虚: {
    spirit_stones: { min: 2500, max: 10000 },
    material_price: { min: 1200, max: 6000 },
    cultivation_exp: { min: 2000, max: 8000 },
    comprehension_insight: { min: 18, max: 45 },
  },
  合体: {
    spirit_stones: { min: 6000, max: 25000 },
    material_price: { min: 3000, max: 15000 },
    cultivation_exp: { min: 5000, max: 20000 },
    comprehension_insight: { min: 25, max: 60 },
  },
  大乘: {
    spirit_stones: { min: 15000, max: 60000 },
    material_price: { min: 8000, max: 40000 },
    cultivation_exp: { min: 12000, max: 50000 },
    comprehension_insight: { min: 35, max: 80 },
  },
  渡劫: {
    spirit_stones: { min: 40000, max: 150000 },
    material_price: { min: 20000, max: 100000 },
    cultivation_exp: { min: 30000, max: 120000 },
    comprehension_insight: { min: 50, max: 100 },
  },
};

/**
 * 评级 → 数值倍率
 * S级获得范围上限，D级获得范围下限
 */
export const TIER_MULTIPLIER: Record<string, ValueRange> = {
  S: { min: 0.8, max: 1.0 }, // 取范围的 80%-100%
  A: { min: 0.6, max: 0.85 }, // 取范围的 60%-85%
  B: { min: 0.4, max: 0.65 }, // 取范围的 40%-65%
  C: { min: 0.2, max: 0.45 }, // 取范围的 20%-45%
  D: { min: 0.1, max: 0.25 }, // 取范围的 10%-25%
};

/**
 * 品质提示 → 品质偏移量
 * 用于在基础品质上进行微调
 */
export const QUALITY_HINT_OFFSET: Record<string, number> = {
  lower: -1,
  medium: 0,
  upper: 1,
};

/**
 * 境界 → 材料品质上限
 *
 * 规则：副本评分和危险系数可以提升品质，但不能突破该境界上限。
 * 目的：避免低境界副本高评分直接产出仙/神品的越级掉落。
 */
export const REALM_QUALITY_CAP: Record<RealmType, Quality> = {
  炼气: '玄品',
  筑基: '真品',
  金丹: '地品',
  元婴: '天品',
  化神: '仙品',
  炼虚: '神品',
  合体: '神品',
  大乘: '神品',
  渡劫: '神品',
};
