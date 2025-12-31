/**
 * 技能系统 - 数值配置表
 *
 * 定义技能创建的各项数值边界和修正系数
 * 所有数值由此文件控制，AI 无法突破
 */

import type { RealmType, SkillGrade, SkillType } from '@/types/constants';
import type { ElementMatch } from './types';

// ============ 境界 → 品阶上限 ============

/**
 * 每个境界能够创建的最高品阶技能
 */
export const REALM_GRADE_LIMIT: Record<RealmType, SkillGrade> = {
  炼气: '黄阶上品',
  筑基: '玄阶上品',
  金丹: '玄阶上品',
  元婴: '地阶上品',
  化神: '地阶上品',
  炼虚: '天阶下品',
  合体: '天阶中品',
  大乘: '天阶中品',
  渡劫: '天阶上品',
};

// ============ 品阶方向提示 → 实际品阶映射 ============

/**
 * AI 的 grade_hint 到实际品阶的映射
 * 后端会根据境界限制进一步调整
 */
export const GRADE_HINT_TO_GRADES: Record<string, SkillGrade[]> = {
  low: ['黄阶下品', '黄阶中品', '黄阶上品'],
  medium: ['玄阶下品', '玄阶中品', '玄阶上品'],
  high: ['地阶下品', '地阶中品', '地阶上品'],
  extreme: ['天阶下品', '天阶中品', '天阶上品'],
};

// ============ 五行契合度 → 数值修正 ============

/**
 * 五行契合度对威力和消耗的影响
 */
export const ELEMENT_MATCH_MODIFIER: Record<
  ElementMatch,
  { power: number; cost: number }
> = {
  perfect_match: { power: 1.3, cost: 0.7 }, // 30%威力加成，30%消耗减少
  partial_match: { power: 1.1, cost: 0.9 }, // 10%威力加成，10%消耗减少
  no_match: { power: 0.8, cost: 1.2 }, // 20%威力惩罚，20%消耗增加
  conflict: { power: 0.5, cost: 1.5 }, // 50%威力惩罚，50%消耗增加
};

// ============ 技能类型 → 特殊规则 ============

export interface SkillTypeModifier {
  /** 威力倍率 */
  power_mult: number;
  /** 是否可以有特效 */
  has_effect: boolean;
  /** 是否默认作用于自身 */
  target_self?: boolean;
  /** 最大持续回合数 */
  max_duration?: number;
}

export const SKILL_TYPE_MODIFIERS: Record<SkillType, SkillTypeModifier> = {
  attack: { power_mult: 1.0, has_effect: false },
  heal: { power_mult: 0.7, has_effect: false, target_self: true },
  control: { power_mult: 0.4, has_effect: true, max_duration: 2 },
  debuff: { power_mult: 0.6, has_effect: true, max_duration: 3 },
  buff: {
    power_mult: 0.6,
    has_effect: true,
    target_self: true,
    max_duration: 3,
  },
};

// ============ 五行相克表 ============

/**
 * 五行相克关系
 */
export const SKILL_ELEMENT_CONFLICT: Record<string, string[]> = {
  火: ['水', '冰'],
  水: ['火', '雷'],
  木: ['金', '火'],
  金: ['木', '火'],
  土: ['木', '水'],
  雷: ['土', '水'],
  冰: ['火'],
  风: ['土'],
};

// ============ 悟性 → 品阶内威力位置 ============

/**
 * 根据悟性计算威力在品阶范围内的位置
 * 悟性越高，威力越接近上限
 *
 * @param wisdom 悟性值 (0-500)
 * @returns 0-1 之间的系数
 */
export function wisdomToPowerRatio(wisdom: number): number {
  // 悟性 0-500 映射到 0.3-1.0
  const clamped = Math.max(0, Math.min(500, wisdom));
  return 0.3 + (clamped / 500) * 0.7;
}

// ============ 冷却计算 ============

/**
 * 根据威力计算冷却回合数
 *
 * @param power 技能威力
 * @returns 冷却回合数 (0-5)
 */
export function calculateCooldown(power: number): number {
  if (power <= 50) return 0;
  if (power <= 80) return 1;
  if (power <= 120) return 2;
  if (power <= 180) return 3;
  if (power <= 240) return 4;
  return 5;
}

// ============ 消耗计算 ============

/**
 * 根据威力计算基础消耗
 *
 * @param power 技能威力
 * @returns 基础消耗值
 */
export function calculateBaseCost(power: number): number {
  // 消耗 = 威力 × 1.2 ~ 1.8
  const ratio = 1.2 + Math.random() * 0.6;
  return Math.floor(power * ratio);
}

// ============ 品阶等级排序 ============

import { SKILL_GRADE_VALUES } from '@/types/constants';

/**
 * 比较两个品阶的高低
 * @returns 正数表示 a 更高，负数表示 b 更高，0 表示相等
 */
export function compareGrades(a: SkillGrade, b: SkillGrade): number {
  const indexA = SKILL_GRADE_VALUES.indexOf(a);
  const indexB = SKILL_GRADE_VALUES.indexOf(b);
  // SKILL_GRADE_VALUES 是从高到低排列的
  return indexB - indexA;
}

/**
 * 获取不超过限制的最高品阶
 */
export function clampGrade(grade: SkillGrade, limit: SkillGrade): SkillGrade {
  if (compareGrades(grade, limit) > 0) {
    return limit;
  }
  return grade;
}
