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
// 词条ID常量
// ============================================================

export const FATE_AFFIX_IDS = {
  // 吉相词条
  AUSPICIOUS_WISDOM: 'fate_a_wisdom',
  AUSPICIOUS_CRIT: 'fate_a_crit',
  AUSPICIOUS_DAMAGE_REDUCTION: 'fate_a_damage_reduction',
  AUSPICIOUS_SPIRIT: 'fate_a_spirit',
  AUSPICIOUS_SPEED: 'fate_a_speed',
  AUSPICIOUS_VITALITY: 'fate_a_vitality',
  AUSPICIOUS_LIFESTEAL: 'fate_a_lifesteal',
  AUSPICIOUS_MANA_REGEN: 'fate_a_mana_regen',
  AUSPICIOUS_HEAL_AMPLIFY: 'fate_a_heal_amplify',
  // 凶相词条
  INAUSPICIOUS_ATTACK_BOOST: 'fate_i_attack_boost',
  INAUSPICIOUS_DEFENSE_PENALTY: 'fate_i_defense_penalty',
  INAUSPICIOUS_LIFESTEAL: 'fate_i_lifesteal',
  INAUSPICIOUS_CRIT_DAMAGE: 'fate_i_crit_damage',
  INAUSPICIOUS_SPEED_BOOST: 'fate_i_speed_boost',
} as const;

// ============================================================
// 吉相词条池 - 纯正面效果
// ============================================================

export const AUSPICIOUS_FATE_AFFIXES: AffixWeight[] = [
  // === 属性增强类 ===
  // 天生道体 - 悟性增幅
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_WISDOM,
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
    displayDescription: '百分比提升悟性，增强领悟能力',
  },
  // 剑骨天成 - 暴击增强
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_CRIT,
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
    displayDescription: '提升暴击率和暴击伤害',
  },
  // 金刚不灭 - 减伤体质
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_DAMAGE_REDUCTION,
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
    displayDescription: '减少受到的伤害',
  },
  // 紫府圣胎 - 法力增强
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_SPIRIT,
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
    displayDescription: '百分比提升灵力',
  },
  // 天赐速身 - 速度增强
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_SPEED,
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
    displayDescription: '百分比提升速度',
  },
  // 铜皮铁骨 - 体魄增强
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_VITALITY,
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
    displayDescription: '百分比提升体魄',
  },

  // === 战斗增益类 ===
  // 天生吸血 - 攻击吸血
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_LIFESTEAL,
    effectType: EffectType.LifeSteal,
    trigger: 'ON_AFTER_DAMAGE',
    paramsTemplate: {
      stealPercent: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 50,
    minQuality: '地品',
    tags: ['secondary', 'sustain', 'lifesteal'],
    displayName: '天生吸血',
    displayDescription: '攻击时按伤害比例吸取生命',
  },
  // 回法体质 - 法力回复
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_MANA_REGEN,
    effectType: EffectType.ManaRegen,
    trigger: 'ON_TURN_END',
    paramsTemplate: {
      percentOfMax: { base: 0.02, scale: 'quality', coefficient: 0.01 },
    },
    weight: 60,
    minQuality: '真品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '回法体质',
    displayDescription: '每回合恢复法力',
  },
  // 木灵体质 - 治疗增幅
  {
    id: FATE_AFFIX_IDS.AUSPICIOUS_HEAL_AMPLIFY,
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
    displayDescription: '增强受到的治疗效果',
  },
];

// ============================================================
// 凶相词条池 - 双刃剑效果（有得有失）
// ============================================================

export const INAUSPICIOUS_FATE_AFFIXES: AffixWeight[] = [
  // 天煞孤星 - 攻强防弱
  {
    id: FATE_AFFIX_IDS.INAUSPICIOUS_ATTACK_BOOST,
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
    displayDescription: '大幅提升灵力，但会降低防御',
  },
  // 天煞孤星(代价) - 防御降低
  {
    id: FATE_AFFIX_IDS.INAUSPICIOUS_DEFENSE_PENALTY,
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
    displayDescription: '降低体魄作为代价',
  },
  // 嗜血魔体 - 吸血但自损
  {
    id: FATE_AFFIX_IDS.INAUSPICIOUS_LIFESTEAL,
    effectType: EffectType.LifeSteal,
    trigger: 'ON_AFTER_DAMAGE',
    paramsTemplate: {
      stealPercent: { base: 0.1, scale: 'quality', coefficient: 0.03 },
    },
    weight: 80,
    minQuality: '真品',
    tags: ['primary', 'lifesteal'],
    displayName: '嗜血魔体(吸)',
    displayDescription: '高额吸血效果，但会有代价',
  },
  // 雷劫缠身 - 暴击高但暴击自伤
  {
    id: FATE_AFFIX_IDS.INAUSPICIOUS_CRIT_DAMAGE,
    effectType: EffectType.Critical,
    trigger: 'ON_STAT_CALC',
    paramsTemplate: {
      critDamageBonus: { base: 0.3, scale: 'quality', coefficient: 0.1 },
    },
    weight: 60,
    minQuality: '地品',
    tags: ['primary', 'burst'],
    displayName: '雷劫缠身',
    displayDescription: '大幅提升暴击伤害',
  },
  // 速而脆 - 速度高但体魄低
  {
    id: FATE_AFFIX_IDS.INAUSPICIOUS_SPEED_BOOST,
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
    displayDescription: '大幅提升速度，但防御较弱',
  },
];

// ============================================================
// 导出词条池
// ============================================================

export const FATE_AFFIX_POOLS = {
  auspicious: AUSPICIOUS_FATE_AFFIXES,
  inauspicious: INAUSPICIOUS_FATE_AFFIXES,
};
