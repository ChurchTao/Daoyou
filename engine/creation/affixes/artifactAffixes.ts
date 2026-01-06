/**
 * 法宝词条池配置
 *
 * 定义法宝可用的所有效果词条，分为：
 * - 主词条：属性加成（StatModifier）
 * - 副词条：特殊效果（暴击、吸血、减伤等）
 * - 诅咒词条：负面效果（五行相克时触发）
 */

import { EffectType, StatModifierType } from '@/engine/effect/types';
import type { AffixPool, AffixWeight } from '../types';

// ============================================================
// 主词条池 - 属性加成
// ============================================================

const PRIMARY_AFFIXES: AffixWeight[] = [
  // 固定值属性加成
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: { base: 10, scale: 'realm', coefficient: 1.5 },
    },
    weight: 100,
    slots: ['weapon', 'armor', 'accessory'],
    tags: ['primary', 'defensive'],
    displayName: '体魄加成',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.FIXED,
      value: { base: 10, scale: 'realm', coefficient: 1.5 },
    },
    weight: 100,
    slots: ['weapon', 'armor', 'accessory'],
    tags: ['primary', 'offensive'],
    displayName: '灵力加成',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.FIXED,
      value: { base: 8, scale: 'realm', coefficient: 1.2 },
    },
    weight: 80,
    slots: ['accessory'],
    tags: ['primary', 'utility'],
    displayName: '悟性加成',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.FIXED,
      value: { base: 8, scale: 'realm', coefficient: 1.2 },
    },
    weight: 80,
    slots: ['weapon', 'armor'],
    tags: ['primary', 'utility'],
    displayName: '速度加成',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.FIXED,
      value: { base: 8, scale: 'realm', coefficient: 1.2 },
    },
    weight: 80,
    slots: ['armor', 'accessory'],
    tags: ['primary', 'defensive'],
    displayName: '神识加成',
  },
  // 百分比属性加成（高品质专属）
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 30,
    slots: ['armor'],
    minQuality: '真品',
    tags: ['primary', 'defensive'],
    displayName: '体魄百分比加成',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 30,
    slots: ['weapon'],
    minQuality: '真品',
    tags: ['primary', 'offensive'],
    displayName: '灵力百分比加成',
  },
];

// ============================================================
// 副词条池 - 特殊效果
// ============================================================

const SECONDARY_AFFIXES: AffixWeight[] = [
  // 暴击相关
  {
    effectType: EffectType.Critical,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      critRateBonus: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 60,
    slots: ['weapon', 'accessory'],
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '暴击率提升',
  },
  {
    effectType: EffectType.Critical,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      critDamageBonus: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 50,
    slots: ['weapon'],
    minQuality: '真品',
    tags: ['secondary', 'offensive'],
    displayName: '暴击伤害提升',
  },
  // 吸血
  {
    effectType: EffectType.LifeSteal,
    trigger: 'ON_AFTER_DAMAGE',
    paramsTemplate: {
      stealPercent: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 40,
    slots: ['weapon'],
    minQuality: '真品',
    tags: ['secondary', 'offensive', 'healing'],
    displayName: '吸血',
  },
  // 减伤
  {
    effectType: EffectType.DamageReduction,
    trigger: 'ON_BEFORE_DAMAGE',
    paramsTemplate: {
      percentReduction: { base: 0.05, scale: 'quality', coefficient: 0.02 },
      maxReduction: 0.5,
    },
    weight: 50,
    slots: ['armor'],
    minQuality: '玄品',
    tags: ['secondary', 'defensive'],
    displayName: '伤害减免',
  },
  {
    effectType: EffectType.DamageReduction,
    trigger: 'ON_BEFORE_DAMAGE',
    paramsTemplate: {
      flatReduction: { base: 10, scale: 'realm', coefficient: 2 },
    },
    weight: 60,
    slots: ['armor'],
    tags: ['secondary', 'defensive'],
    displayName: '固定减伤',
  },
  // 反伤
  {
    effectType: EffectType.ReflectDamage,
    trigger: 'ON_AFTER_DAMAGE',
    paramsTemplate: {
      reflectPercent: { base: 0.05, scale: 'quality', coefficient: 0.03 },
    },
    weight: 30,
    slots: ['armor'],
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '伤害反射',
  },
  // 命中附加状态
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'burn',
      chance: { base: 0.1, scale: 'quality', coefficient: 0.05 },
      durationOverride: 2,
    },
    weight: 40,
    slots: ['weapon'],
    minQuality: '玄品',
    tags: ['secondary', 'offensive', 'dot'],
    displayName: '灼烧附加',
  },
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'poison',
      chance: { base: 0.1, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 35,
    slots: ['weapon'],
    minQuality: '玄品',
    tags: ['secondary', 'offensive', 'dot'],
    displayName: '中毒附加',
  },
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'freeze',
      chance: { base: 0.08, scale: 'quality', coefficient: 0.03 },
      durationOverride: 1,
    },
    weight: 25,
    slots: ['weapon'],
    minQuality: '地品',
    tags: ['secondary', 'offensive', 'control'],
    displayName: '冰冻附加',
  },
  // 护盾
  {
    effectType: EffectType.Shield,
    trigger: 'ON_TURN_START',
    paramsTemplate: {
      amount: { base: 50, scale: 'realm', coefficient: 3 },
      duration: 1,
    },
    weight: 30,
    slots: ['armor', 'accessory'],
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '回合护盾',
  },
  // 命中率/闪避率
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'hitRate',
      modType: StatModifierType.FIXED,
      value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
    },
    weight: 40,
    slots: ['weapon', 'accessory'],
    tags: ['secondary', 'utility'],
    displayName: '命中率提升',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'dodgeRate',
      modType: StatModifierType.FIXED,
      value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
    },
    weight: 40,
    slots: ['armor', 'accessory'],
    tags: ['secondary', 'defensive'],
    displayName: '闪避率提升',
  },
];

// ============================================================
// 诅咒词条池 - 负面效果（五行相克触发）
// ============================================================

const CURSE_AFFIXES: AffixWeight[] = [
  // 使用消耗生命
  {
    effectType: EffectType.DotDamage,
    trigger: 'ON_TURN_START',
    paramsTemplate: {
      baseDamage: { base: 5, scale: 'realm', coefficient: 1 },
      usesCasterStats: false,
    },
    weight: 100,
    tags: ['curse'],
    displayName: '反噬诅咒',
  },
  // 属性削减
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: -0.05,
    },
    weight: 80,
    tags: ['curse'],
    displayName: '灵力削减',
  },
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: -0.05,
    },
    weight: 80,
    tags: ['curse'],
    displayName: '体魄削减',
  },
];

// ============================================================
// 导出词条池
// ============================================================

export const ARTIFACT_AFFIX_POOL: AffixPool = {
  primary: PRIMARY_AFFIXES,
  secondary: SECONDARY_AFFIXES,
  curse: CURSE_AFFIXES,
};

/**
 * 根据方向标签获取推荐的主词条
 */
export function getRecommendedPrimaryAffix(
  directionTag: string,
): string | undefined {
  const tagToStat: Record<string, string> = {
    increase_vitality: 'vitality',
    increase_spirit: 'spirit',
    increase_wisdom: 'wisdom',
    increase_speed: 'speed',
    increase_willpower: 'willpower',
    defense_boost: 'vitality',
    critical_boost: 'critRate',
  };
  return tagToStat[directionTag];
}
