/**
 * 数值化随机配置
 *
 * 控制效果数值的随机波动和闪光机制
 */

import type { Quality } from '@/types/constants';

/**
 * 数值化配置
 */
export const MATERIALIZATION_CONFIG = {
  /** 是否启用随机波动（全局开关） */
  enableVariance: true,

  /** 是否启用闪光机制（全局开关） */
  enablePerfect: true,

  /**
   * 波动范围配置
   * 采用梯形分布：70% 落在核心区间，20% 高值，10% 极端
   */
  variance: {
    /** 最小倍率（-30%） */
    min: 0.7,
    /** 最大倍率（+50%） */
    max: 1.5,
    /** 核心区间下限（-15%） */
    coreMin: 0.85,
    /** 核心区间上限（+15%） */
    coreMax: 1.15,
  },

  /**
   * 闪光概率配置
   */
  perfectChance: {
    /** 基础概率（1%） */
    base: 0.01,
    /** 品质加成 */
    qualityBonus: {
      凡品: 0,
      灵品: 0,
      玄品: 0,
      真品: 0.001,
      地品: 0.002,
      天品: 0.003,
      仙品: 0.005,
      神品: 0.01,
    } as Record<Quality, number>,
  },

  /** 闪光额外加成倍率（+50%） */
  perfectBonus: 1.5,

  /**
   * 品质评级阈值
   * - poor: variance < 0.85
   * - normal: 0.85 <= variance < 1.15
   * - good: 1.15 <= variance < 1.35
   * - perfect: variance >= 1.35 或触发闪光
   */
  qualityThresholds: {
    poor: 0.85,
    normal: 1.15,
    good: 1.35,
  },
} as const;
