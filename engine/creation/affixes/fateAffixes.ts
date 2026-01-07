/**
 * 命格效果词条池配置
 *
 * 命格效果分为：
 * - 吉相命格：正面效果（属性增强、战斗增益）
 * - 凶相命格：双刃剑效果（有得有失）
 *
 * 与其他系统不同，命格效果是永久被动的
 */

import { EffectType, StatModifierType } from '@/engine/effect/types';
import type { AffixWeight } from '../types';

// ============================================================
// 吉相词条池 - 纯正面效果
// ============================================================

export const AUSPICIOUS_FATE_AFFIXES: AffixWeight[] = [
  // === 属性增强类 ===
  // 天生道体 - 悟性增幅
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 100,
    tags: ['primary', 'utility'],
    displayName: '天生道体',
  },
  // 剑骨天成 - 暴击增强
  {
    effectType: EffectType.Critical,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      critRateBonus: { base: 0.05, scale: 'quality', coefficient: 0.03 },
      critDamageBonus: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 80,
    minQuality: '真品',
    tags: ['primary', 'offensive', 'burst'],
    displayName: '剑骨天成',
  },
  // 金刚不灭 - 减伤体质
  {
    effectType: EffectType.DamageReduction,
    trigger: 'ON_BEFORE_DAMAGE',
    paramsTemplate: {
      percentReduction: { base: 0.08, scale: 'quality', coefficient: 0.03 },
      maxReduction: 0.6,
    },
    weight: 80,
    minQuality: '真品',
    tags: ['primary', 'defensive'],
    displayName: '金刚不灭',
  },
  // 紫府圣胎 - 法力增强
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 90,
    tags: ['primary', 'offensive'],
    displayName: '紫府圣胎',
  },
  // 天赐速身 - 速度增强
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.PERCENT,
      value: { base: 0.08, scale: 'quality', coefficient: 0.04 },
    },
    weight: 70,
    tags: ['primary', 'utility'],
    displayName: '天赐速身',
  },
  // 铜皮铁骨 - 体魄增强
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 90,
    tags: ['primary', 'defensive'],
    displayName: '铜皮铁骨',
  },

  // === 战斗增益类 ===
  // 天生吸血 - 攻击吸血
  {
    effectType: EffectType.LifeSteal,
    trigger: 'ON_AFTER_DAMAGE',
    paramsTemplate: {
      stealPercent: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 50,
    minQuality: '地品',
    tags: ['secondary', 'sustain', 'lifesteal'],
    displayName: '天生吸血',
  },
  // 回法体质 - 法力回复
  {
    effectType: EffectType.ManaRegen,
    trigger: 'ON_TURN_END',
    paramsTemplate: {
      percentOfMax: { base: 0.02, scale: 'quality', coefficient: 0.01 },
    },
    weight: 60,
    minQuality: '真品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '回法体质',
  },
  // 木灵体质 - 治疗增幅
  {
    effectType: EffectType.HealAmplify,
    trigger: 'ON_HEAL',
    paramsTemplate: {
      amplifyPercent: { base: 0.1, scale: 'quality', coefficient: 0.05 },
      affectOutgoing: false,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['secondary', 'healing_boost'],
    displayName: '木灵体质',
  },
];

// ============================================================
// 凶相词条池 - 双刃剑效果（有得有失）
// ============================================================

export const INAUSPICIOUS_FATE_AFFIXES: AffixWeight[] = [
  // 天煞孤星 - 攻强防弱
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.15, scale: 'quality', coefficient: 0.05 },
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '天煞孤星(攻)',
  },
  // 天煞孤星(代价) - 防御降低
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: { base: -0.1, scale: 'quality', coefficient: -0.03 },
    },
    weight: 100,
    tags: ['primary', 'defensive'],
    displayName: '天煞孤星(防)',
  },
  // 嗜血魔体 - 吸血但自损
  {
    effectType: EffectType.LifeSteal,
    trigger: 'ON_AFTER_DAMAGE',
    paramsTemplate: {
      stealPercent: { base: 0.1, scale: 'quality', coefficient: 0.03 },
    },
    weight: 80,
    minQuality: '真品',
    tags: ['primary', 'lifesteal'],
    displayName: '嗜血魔体(吸)',
  },
  // 雷劫缠身 - 暴击高但暴击自伤
  {
    effectType: EffectType.Critical,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      critDamageBonus: { base: 0.3, scale: 'quality', coefficient: 0.1 },
    },
    weight: 60,
    minQuality: '地品',
    tags: ['primary', 'burst'],
    displayName: '雷劫缠身',
  },
  // 速而脆 - 速度高但体魄低
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.PERCENT,
      value: { base: 0.2, scale: 'quality', coefficient: 0.05 },
    },
    weight: 70,
    tags: ['primary', 'utility'],
    displayName: '疾风体质(速)',
  },
];

// ============================================================
// 导出词条池
// ============================================================

export const FATE_AFFIX_POOLS = {
  auspicious: AUSPICIOUS_FATE_AFFIXES,
  inauspicious: INAUSPICIOUS_FATE_AFFIXES,
};
