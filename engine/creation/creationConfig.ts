/**
 * 造物系统 - 数值配置表
 *
 * 定义每个境界的造物数值范围和品质倍率
 * 所有数值边界由此文件控制，AI 无法突破
 */

import type { Quality, RealmType } from '@/types/constants';
import type { CreationRangeConfig, ValueRange } from './types';

// ============ 境界 → 造物数值范围 ============

export const CREATION_CONFIG: Record<RealmType, CreationRangeConfig> = {
  炼气: {
    artifact_bonus: { min: 5, max: 15 },
    effect_power: { min: 3, max: 8 },
    effect_chance: { min: 5, max: 15 },
    max_effects: 0, // 炼气期无法炼制带特效的法宝
    consumable_effect: { min: 1, max: 2 },
  },
  筑基: {
    artifact_bonus: { min: 20, max: 40 },
    effect_power: { min: 5, max: 15 },
    effect_chance: { min: 10, max: 20 },
    max_effects: 1,
    consumable_effect: { min: 2, max: 4 },
  },
  金丹: {
    artifact_bonus: { min: 40, max: 80 },
    effect_power: { min: 10, max: 25 },
    effect_chance: { min: 15, max: 30 },
    max_effects: 2,
    consumable_effect: { min: 3, max: 6 },
  },
  元婴: {
    artifact_bonus: { min: 80, max: 160 },
    effect_power: { min: 20, max: 50 },
    effect_chance: { min: 20, max: 40 },
    max_effects: 2,
    consumable_effect: { min: 5, max: 10 },
  },
  化神: {
    artifact_bonus: { min: 160, max: 320 },
    effect_power: { min: 40, max: 100 },
    effect_chance: { min: 25, max: 50 },
    max_effects: 3,
    consumable_effect: { min: 8, max: 15 },
  },
  炼虚: {
    artifact_bonus: { min: 320, max: 640 },
    effect_power: { min: 80, max: 200 },
    effect_chance: { min: 30, max: 60 },
    max_effects: 3,
    consumable_effect: { min: 12, max: 25 },
  },
  合体: {
    artifact_bonus: { min: 640, max: 1280 },
    effect_power: { min: 150, max: 400 },
    effect_chance: { min: 35, max: 70 },
    max_effects: 4,
    consumable_effect: { min: 20, max: 40 },
  },
  大乘: {
    artifact_bonus: { min: 1280, max: 2560 },
    effect_power: { min: 300, max: 800 },
    effect_chance: { min: 40, max: 80 },
    max_effects: 4,
    consumable_effect: { min: 35, max: 70 },
  },
  渡劫: {
    artifact_bonus: { min: 2560, max: 5120 },
    effect_power: { min: 600, max: 1500 },
    effect_chance: { min: 50, max: 90 },
    max_effects: 5,
    consumable_effect: { min: 60, max: 120 },
  },
};

// ============ 材料品质 → 数值倍率 ============

/**
 * 品质倍率决定从境界范围中取值的区间
 * 例如：筑基境 artifact_bonus 为 20-40
 * 凡品材料 → 取 20 + (40-20) * 0.1 ~ 0.25 = 22 ~ 25
 * 神品材料 → 取 20 + (40-20) * 0.95 ~ 1.0 = 39 ~ 40
 */
export const QUALITY_MULTIPLIER: Record<Quality, ValueRange> = {
  凡品: { min: 0.1, max: 0.25 },
  灵品: { min: 0.2, max: 0.4 },
  玄品: { min: 0.35, max: 0.55 },
  真品: { min: 0.5, max: 0.7 },
  地品: { min: 0.65, max: 0.85 },
  天品: { min: 0.8, max: 0.95 },
  仙品: { min: 0.9, max: 1.0 },
  神品: { min: 0.95, max: 1.0 },
};

// ============ 品质 → 最大特效数量限制 ============

export const QUALITY_MAX_EFFECTS: Record<Quality, number> = {
  凡品: 0,
  灵品: 0,
  玄品: 1,
  真品: 1,
  地品: 2,
  天品: 2,
  仙品: 3,
  神品: 3,
};

// ============ 品质 → 属性条数限制 ============

export const QUALITY_MAX_BONUS_COUNT: Record<Quality, number> = {
  凡品: 1,
  灵品: 1,
  玄品: 1,
  真品: 2,
  地品: 2,
  天品: 2,
  仙品: 3,
  神品: 3,
};

// ============ 槽位 → 允许的属性 ============

import type { Attributes } from '@/types/cultivator';

export const SLOT_ALLOWED_ATTRIBUTES: Record<string, (keyof Attributes)[]> = {
  weapon: ['vitality', 'spirit', 'speed'],
  armor: ['vitality', 'spirit', 'willpower'],
  accessory: ['spirit', 'wisdom', 'willpower'],
};

// ============ 成丹数量映射 ============

export const QUANTITY_HINT_MAP: Record<string, ValueRange> = {
  single: { min: 1, max: 1 },
  medium: { min: 1, max: 2 },
  batch: { min: 2, max: 3 },
};

// ============ 元素相克表（用于诅咒判定）============

export const ELEMENT_CONFLICT: Record<string, string[]> = {
  火: ['水', '冰'],
  水: ['火', '雷'],
  木: ['金', '火'],
  金: ['木', '火'],
  土: ['木', '水'],
  雷: ['土', '水'],
  冰: ['火'],
  风: ['土'],
};

/**
 * 检测材料之间是否存在元素相克
 */
export function hasElementConflict(elements: (string | undefined)[]): boolean {
  const validElements = elements.filter((e): e is string => !!e);
  for (const el of validElements) {
    const conflicts = ELEMENT_CONFLICT[el] || [];
    for (const other of validElements) {
      if (conflicts.includes(other)) {
        return true;
      }
    }
  }
  return false;
}
