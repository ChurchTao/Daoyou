/**
 * 技能系统 - 数值配置表
 *
 * 定义技能创建的各项数值边界和修正系数
 * 所有数值由此文件控制，AI 无法突破
 */

import type {
  Quality,
  RealmType,
  SkillGrade,
  SkillType,
} from '@/types/constants';

// ============ 品阶数值化配置 ============

/**
 * 品阶到数字等级的映射（用于提示词数值化）
 * 数值越高，品阶越高，AI 更容易理解高低关系
 */
export const GRADE_TO_RANK: Record<SkillGrade, number> = {
  黄阶下品: 1,
  黄阶中品: 2,
  黄阶上品: 3,
  玄阶下品: 4,
  玄阶中品: 5,
  玄阶上品: 6,
  地阶下品: 7,
  地阶中品: 8,
  地阶上品: 9,
  天阶下品: 10,
  天阶中品: 11,
  天阶上品: 12,
};

/**
 * 数字等级到品阶的映射
 */
export const RANK_TO_GRADE: Record<number, SkillGrade> = {
  1: '黄阶下品',
  2: '黄阶中品',
  3: '黄阶上品',
  4: '玄阶下品',
  5: '玄阶中品',
  6: '玄阶上品',
  7: '地阶下品',
  8: '地阶中品',
  9: '地阶上品',
  10: '天阶下品',
  11: '天阶中品',
  12: '天阶上品',
};

// ============ 材料品质 → 品阶基准映射 ============

/**
 * 材料品质数值化等级（用于让AI理解品质水准）
 */
export const QUALITY_TO_NUMERIC_LEVEL: Record<Quality, number> = {
  凡品: 10,
  灵品: 25,
  玄品: 40,
  真品: 55,
  地品: 70,
  天品: 85,
  仙品: 100,
  神品: 120,
};

/**
 * 材料品质直接对应品阶基准
 * 材料决定70%的品阶权重
 */
export const QUALITY_TO_BASE_GRADE: Record<Quality, SkillGrade> = {
  凡品: '黄阶下品',
  灵品: '黄阶中品',
  玄品: '玄阶下品',
  真品: '玄阶中品',
  地品: '地阶下品',
  天品: '地阶中品',
  仙品: '天阶下品',
  神品: '天阶中品',
};

// 技能品阶到品质的映射（用于词条过滤）
export const GRADE_TO_QUALITY: Record<string, Quality> = {
  黄阶下品: '灵品',
  黄阶中品: '灵品',
  黄阶上品: '玄品',
  玄阶下品: '玄品',
  玄阶中品: '真品',
  玄阶上品: '真品',
  地阶下品: '地品',
  地阶中品: '地品',
  地阶上品: '天品',
  天阶下品: '天品',
  天阶中品: '仙品',
  天阶上品: '神品',
};

// ============ 境界折扣率配置 ============

/**
 * 境界等级映射（用于计算折扣）
 */
export const REALM_TO_RANK: Record<RealmType, number> = {
  炼气: 1,
  筑基: 2,
  金丹: 3,
  元婴: 4,
  化神: 5,
  炼虚: 6,
  合体: 7,
  大乘: 8,
  渡劫: 9,
};

/**
 * 计算境界折扣系数
 * 材料品阶 > 当前境界 → 折扣（模拟"只能学皮毛"）
 */
export function calculateRealmDiscount(
  materialGrade: SkillGrade,
  realm: RealmType,
): number {
  const materialRank = GRADE_TO_RANK[materialGrade];
  const realmRank = REALM_TO_RANK[realm];

  // 计算境界允许的最高品阶等级
  const realmMaxRank = realmRank * 3 + 3;

  // 如果材料品阶不超过境界允许范围，无折扣
  if (materialRank <= realmMaxRank) {
    return 1.0;
  }

  // 计算差距，每超出3级折扣10%
  const gap = materialRank - realmMaxRank;
  const discount = 1.0 - Math.floor(gap / 3) * 0.1;

  return Math.max(0.3, discount);
}

/**
 * 应用折扣系数到品阶
 */
export function applyGradeDiscount(
  baseGrade: SkillGrade,
  discount: number,
): SkillGrade {
  if (discount >= 1.0) return baseGrade;

  const baseRank = GRADE_TO_RANK[baseGrade];
  const discountedRank = Math.floor(baseRank * discount);

  // 确保不低于黄阶下品
  return RANK_TO_GRADE[Math.max(1, discountedRank)] || '黄阶下品';
}

// ============ 境界 → 品阶上限 ============

/**
 * 每个境界能够创建的最高品阶技能
 * 已优化境界递进，化神期可达天阶下品
 */
export const REALM_GRADE_LIMIT: Record<RealmType, SkillGrade> = {
  炼气: '黄阶上品', // 等级 3
  筑基: '玄阶上品', // 等级 6
  金丹: '玄阶上品', // 等级 6
  元婴: '地阶上品', // 等级 9
  化神: '天阶下品', // 等级 10（优化：从地阶上品提升）
  炼虚: '天阶中品', // 等级 11（优化：从天阶下品提升）
  合体: '天阶上品', // 等级 12（优化：从天阶中品提升）
  大乘: '天阶上品', // 等级 12
  渡劫: '天阶上品', // 等级 12
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

// ============ 威力位置计算（基于境界、材料、灵根） ============

/**
 * 计算威力在品阶范围内的位置
 * 综合考虑修士境界、材料品质、灵根属性和强度
 *
 * @param realm 修士境界
 * @param materialQuality 材料品质
 * @param spiritualRootStrength 灵根强度 (0-100)
 * @param hasMatchingElement 是否有匹配的灵根属性
 * @returns 0-1 之间的系数
 */
export function calculatePowerRatio(
  realm: RealmType,
  materialQuality: string,
  spiritualRootStrength: number,
  hasMatchingElement: boolean,
): number {
  // 1. 境界加成 (炼气~渡劫 = 0~0.4)
  const realmIndex = [
    '炼气',
    '筑基',
    '金丹',
    '元婴',
    '化神',
    '炼虚',
    '合体',
    '大乘',
    '渡劫',
  ].indexOf(realm);
  const realmBonus = (realmIndex / 8) * 0.4;

  // 2. 材料品质加成 (0~0.3)
  const qualityIndex = [
    '凡品',
    '灵品',
    '玄品',
    '真品',
    '地品',
    '天品',
    '仙品',
    '神品',
  ].indexOf(materialQuality);
  const qualityBonus = (qualityIndex / 7) * 0.3;

  // 3. 灵根强度加成 (0~0.2)
  const rootBonus = (spiritualRootStrength / 100) * 0.2;

  // 4. 元素匹配加成 (0~0.1)
  const elementBonus = hasMatchingElement ? 0.1 : 0;

  // 基础系数 + 各项加成，上限 1.0
  const ratio = 0.3 + realmBonus + qualityBonus + rootBonus + elementBonus;
  return Math.min(1.0, Math.max(0.3, ratio));
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
