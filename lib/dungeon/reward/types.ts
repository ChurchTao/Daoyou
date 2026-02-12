/**
 * 副本奖励系统 - 类型定义
 *
 * 采用"AI创意 + 程序数值化"的混合架构：
 * - AI 生成奖励蓝图（名称、描述、方向性标签）
 * - 程序根据境界门槛和评级生成具体数值
 */

import type { ElementType } from '@/types/constants';

/**
 * 奖励类型 - 限定为资源引擎支持的类型
 * Simplified: removed artifact and consumable generation
 * These can still be gained from other sources, but not from dungeon rewards
 *
 * AI 只需要生成 material 类型，其他类型由程序自动计算
 */
export type RewardType =
  | 'spirit_stones'
  | 'material'
  | 'cultivation_exp'
  | 'comprehension_insight';

/**
 * 品质提示
 */
export type QualityHint = 'lower' | 'medium' | 'upper';

/**
 * AI生成的奖励蓝图 - 只包含创意内容，不包含数值
 */
export interface RewardBlueprint {
  /** 物品名称 (AI创意) - 仅 material 需要 */
  name?: string;

  /** 物品描述 (AI创意) - 仅 material 需要 */
  description?: string;

  /** 品质等级提示 - 仅 material 需要 */
  quality_hint?: QualityHint;

  /** 元素标签 - 仅 material 需要 */
  element?: ElementType;

  /** 材料类型 - 仅 material 需要 */
  material_type?:
    | 'herb'
    | 'ore'
    | 'monster'
    | 'tcdb'
    | 'aux'
    | 'gongfa_manual'
    | 'skill_manual';
}

/**
 * 数值范围配置
 */
export interface ValueRange {
  min: number;
  max: number;
}

/**
 * 境界奖励范围配置
 */
export interface RewardRangeConfig {
  /** 灵石数量范围 */
  spirit_stones: ValueRange;
  /** 材料价值范围 */
  material_price: ValueRange;
  /** 修为值范围 */
  cultivation_exp: ValueRange;
  /** 感悟值范围 */
  comprehension_insight: ValueRange;
}
