/**
 * 丹药词条池配置
 *
 * 根据当前效果系统实现，丹药只能提供永久属性提升（通过 EffectType.ConsumeStatModifier 实现）。
 *
 * 词条类型：
 * - 主词条：永久属性提升（体魄、灵力、悟性、速度、神识）
 */

import {
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { AffixPool, AffixWeight } from '../types';

// ============================================================
// 词条ID常量
// ============================================================

export const CONSUMABLE_AFFIX_IDS = {
  // 主词条 - 永久属性提升
  PRIMARY_VITALITY: 'consumable_p_vitality',
  PRIMARY_SPIRIT: 'consumable_p_spirit',
  PRIMARY_WISDOM: 'consumable_p_wisdom',
  PRIMARY_SPEED: 'consumable_p_speed',
  PRIMARY_WILLPOWER: 'consumable_p_willpower',
} as const;

// ============================================================
// 主词条池 - 永久属性提升
// ============================================================

const PRIMARY_AFFIXES: AffixWeight[] = [
  // 永久体魄提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_VITALITY,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME, // 特殊触发器：服用时触发，永久生效
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'defensive'],
    displayName: '永久提升体魄',
    displayDescription: '永久增加体魄属性，数值随境界提升',
  },
  // 永久灵力提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_SPIRIT,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '永久提升灵力',
    displayDescription: '永久增加灵力属性，数值随境界提升',
  },
  // 永久悟性提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_WISDOM,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'quality', coefficient: 0.3 },
    },
    weight: 70,
    minQuality: '玄品',
    tags: ['primary', 'utility'],
    displayName: '永久提升悟性',
    displayDescription: '永久增加悟性属性，数值随境界提升',
  },
  // 永久速度提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_SPEED,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'quality', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'utility'],
    displayName: '永久提升速度',
    displayDescription: '永久增加速度属性，数值随境界提升',
  },
  // 永久神识提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_WILLPOWER,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'quality', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'defensive'],
    displayName: '永久提升神识',
    displayDescription: '永久增加神识属性，数值随境界提升',
  },
];

// ============================================================
// 副词条池 - 临时增益/特殊效果
// ============================================================
// 已移除：根据当前效果系统实现，丹药只能提供永久属性提升（通过 EffectType.ConsumeStatModifier 实现）
// 临时效果（回血、回蓝、Buff等）不再用于丹药

const SECONDARY_AFFIXES: AffixWeight[] = [];

// ============================================================
// 诅咒词条池 - 负面效果（低品质或炼制失败）
// ============================================================
// 已移除：诅咒词条已从丹药系统中移除

const CURSE_AFFIXES: AffixWeight[] = [];

// ============================================================
// 导出词条池
// ============================================================

export const CONSUMABLE_AFFIX_POOL: AffixPool = {
  primary: PRIMARY_AFFIXES,
  secondary: SECONDARY_AFFIXES,
  curse: CURSE_AFFIXES,
};
