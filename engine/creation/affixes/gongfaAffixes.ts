/**
 * 功法效果词条池配置
 *
 * 功法（Passive Skills）主要提供被动属性加成和特殊被动效果。
 */

import {
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { AffixWeight } from '../types';

export const GONGFA_AFFIX_IDS = {
  // 基础属性类
  VITALITY_BOOST: 'gongfa_vitality',
  SPIRIT_BOOST: 'gongfa_spirit',
  WISDOM_BOOST: 'gongfa_wisdom',
  SPEED_BOOST: 'gongfa_speed',
  WILLPOWER_BOOST: 'gongfa_willpower',

  // 战斗属性类
  CRIT_RATE_BOOST: 'gongfa_crit_rate',
  CRIT_DMG_BOOST: 'gongfa_crit_dmg',
  DMG_REDUCTION: 'gongfa_dmg_reduction',
  HIT_RATE_BOOST: 'gongfa_hit_rate',
  DODGE_RATE_BOOST: 'gongfa_dodge_rate',

  // 特殊机制类
  MANA_REGEN: 'gongfa_mana_regen',
  LIFESTEAL: 'gongfa_lifesteal',
} as const;

export const GONGFA_AFFIXES: AffixWeight[] = [
  // === 基础属性 ===
  {
    id: GONGFA_AFFIX_IDS.VITALITY_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 100,
    tags: ['primary', 'defensive'],
    displayName: '强体诀',
    displayDescription: '修炼肉身，大幅提升体魄',
  },
  {
    id: GONGFA_AFFIX_IDS.SPIRIT_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '聚气诀',
    displayDescription: '吞吐灵气，大幅提升灵力',
  },
  {
    id: GONGFA_AFFIX_IDS.WISDOM_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 80,
    tags: ['primary', 'utility'],
    displayName: '明心诀',
    displayDescription: '明心见性，大幅提升悟性',
  },
  {
    id: GONGFA_AFFIX_IDS.SPEED_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.PERCENT,
      value: { base: 0.08, scale: 'quality', coefficient: 0.04 },
    },
    weight: 80,
    tags: ['primary', 'utility'],
    displayName: '御风诀',
    displayDescription: '身轻如燕，大幅提升速度',
  },
  {
    id: GONGFA_AFFIX_IDS.WILLPOWER_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
    },
    weight: 80,
    tags: ['primary', 'defensive'],
    displayName: '炼神诀',
    displayDescription: '锤炼神识，大幅提升神识',
  },

  // === 战斗属性 ===
  {
    id: GONGFA_AFFIX_IDS.CRIT_RATE_BOOST,
    effectType: EffectType.Critical,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      critRateBonus: { base: 0.05, scale: 'quality', coefficient: 0.02 },
      critDamageBonus: 0,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '凝元功',
    displayDescription: '提升暴击率',
  },
  {
    id: GONGFA_AFFIX_IDS.DMG_REDUCTION,
    effectType: EffectType.DamageReduction,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      percentReduction: { base: 0.05, scale: 'quality', coefficient: 0.02 },
      maxReduction: 0.5,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'defensive'],
    displayName: '金钟罩',
    displayDescription: '减少受到的伤害',
  },

  // === 特殊机制 ===
  {
    id: GONGFA_AFFIX_IDS.MANA_REGEN,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.01, scale: 'quality', coefficient: 0.01 },
    },
    weight: 40,
    minQuality: '真品',
    tags: ['secondary', 'sustain'],
    displayName: '生生不息',
    displayDescription: '每回合回复少量灵力',
  },
];

export function getGongFaAffixPool() {
  return {
    primary: GONGFA_AFFIXES.filter((a) => a.tags?.includes('primary')),
    secondary: GONGFA_AFFIXES.filter((a) => a.tags?.includes('secondary')),
  };
}
