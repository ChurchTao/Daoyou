/**
 * 造物系统 - 数值配置表
 *
 * 定义品质倍率、数量映射和元素相克等配置
 */

import type { Quality } from '@/types/constants';
import type { ValueRange } from './types';

// ============ 材料品质 → 数值倍率 ============

/**
 * 品质倍率决定数值计算时的缩放系数
 * 用于 EffectMaterializer 计算效果数值
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
