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

  // 新增：暴击系
  CRIT_MASTERY: 'gongfa_crit_mastery',

  // 新增：生存系
  UNDYING_BODY: 'gongfa_undying_body',
  TURTLE_BREATH: 'gongfa_turtle_breath',

  // 新增：反击系
  COUNTER_STANCE: 'gongfa_counter_stance',
  MIRROR_ART: 'gongfa_mirror_art',

  // 新增：吸血系
  BLOOD_THIRST: 'gongfa_blood_thirst',
  MANA_DRAIN: 'gongfa_mana_drain',

  // 新增：法力系
  MANA_FOCUS: 'gongfa_mana_focus',
  BREAKTHROUGH_MANA: 'gongfa_breakthrough_mana',

  // 新增：元素系
  FIRE_ESSENCE: 'gongfa_fire_essence',
  THUNDER_ESSENCE: 'gongfa_thunder_essence',

  // 新增：境界相关
  BREAKTHROUGH_INSIGHT: 'gongfa_breakthrough_insight',
  BREAKTHROUGH_SHIELD: 'gongfa_breakthrough_shield',
  UNITY: 'gongfa_unity',

  // 新增：风险收益类
  BERSERK_MODE: 'gongfa_berserk_mode',
  SACRIFICE: 'gongfa_sacrifice',
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

  // === 新增：暴击系 ===
  {
    id: GONGFA_AFFIX_IDS.CRIT_MASTERY,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_BATTLE_START,
    paramsTemplate: {
      buffId: 'crit_boost',
      durationOverride: -1, // 永久
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'offensive', 'burst'],
    displayName: '破军诀',
    displayDescription: '战斗开始时获得暴击增益，持续战斗',
  },

  // === 新增：生存系 ===
  {
    id: GONGFA_AFFIX_IDS.UNDYING_BODY,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      buffId: 'regeneration',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 45,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '不灭体',
    displayDescription: '每回合结束时获得持续回复',
  },
  {
    id: GONGFA_AFFIX_IDS.TURTLE_BREATH,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      buffId: 'turtle_defense',
      durationOverride: 1,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '龟息功',
    displayDescription: '受到攻击时进入龟息状态',
  },

  // === 新增：反击系 ===
  {
    id: GONGFA_AFFIX_IDS.COUNTER_STANCE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_BATTLE_START,
    paramsTemplate: {
      buffId: 'counter_stance',
      durationOverride: -1,
      targetSelf: true,
    },
    weight: 40,
    minQuality: '真品',
    tags: ['secondary', 'counter', 'defensive'],
    displayName: '反击姿态',
    displayDescription: '战斗开始时获得反击能力',
  },
  {
    id: GONGFA_AFFIX_IDS.MIRROR_ART,
    effectType: EffectType.ReflectDamage,
    trigger: EffectTrigger.ON_BEING_HIT,
    paramsTemplate: {
      reflectPercent: { base: 0.1, scale: 'quality', coefficient: 0.03 },
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '镜像诀',
    displayDescription: '被攻击时反弹伤害',
  },

  // === 新增：吸血系 ===
  {
    id: GONGFA_AFFIX_IDS.BLOOD_THIRST,
    effectType: EffectType.LifeSteal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      stealPercent: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 45,
    minQuality: '真品',
    tags: ['secondary', 'lifesteal', 'sustain'],
    displayName: '嗜血术',
    displayDescription: '技能命中时回复生命值',
  },
  {
    id: GONGFA_AFFIX_IDS.MANA_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.08, scale: 'quality', coefficient: 0.03 },
      restoreToSelf: true,
    },
    weight: 40,
    minQuality: '真品',
    tags: ['secondary', 'sustain'],
    displayName: '夺元功',
    displayDescription: '技能命中时吸取法力值',
  },

  // === 新增：法力系 ===
  {
    id: GONGFA_AFFIX_IDS.MANA_FOCUS,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      percentOfMax: { base: 0.03, scale: 'quality', coefficient: 0.01 },
    },
    weight: 50,
    minQuality: '玄品',
    tags: ['secondary', 'sustain'],
    displayName: '聚灵诀',
    displayDescription: '消耗法力时回复法力值',
  },
  {
    id: GONGFA_AFFIX_IDS.BREAKTHROUGH_MANA,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_BREAKTHROUGH,
    paramsTemplate: {
      buffId: 'regeneration',
      durationOverride: 5,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'sustain'],
    displayName: '灵枢法',
    displayDescription: '境界突破后获得持续回复',
  },

  // === 新增：元素系 ===
  {
    id: GONGFA_AFFIX_IDS.FIRE_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '火',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.03 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '火灵诀',
    displayDescription: '提升火属性技能伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.THUNDER_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '雷',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.03 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '雷神诀',
    displayDescription: '提升雷属性技能伤害',
  },

  // === 新增：境界相关 ===
  {
    id: GONGFA_AFFIX_IDS.BREAKTHROUGH_INSIGHT,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_BREAKTHROUGH,
    paramsTemplate: {
      stat: 'allStats',
      modType: StatModifierType.PERCENT,
      value: { base: 0.03, scale: 'realm', coefficient: 0.01 },
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'utility'],
    displayName: '突破感悟',
    displayDescription: '境界突破时永久提升全属性',
  },
  {
    id: GONGFA_AFFIX_IDS.BREAKTHROUGH_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_BREAKTHROUGH,
    paramsTemplate: {
      amount: { base: 100, scale: 'realm', coefficient: 50 },
      duration: 3,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '境界稳固',
    displayDescription: '境界突破后获得护盾',
  },
  {
    id: GONGFA_AFFIX_IDS.UNITY,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_BREAKTHROUGH,
    paramsTemplate: {
      buffId: 'all_stats_up',
      durationOverride: 5,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'burst'],
    displayName: '天人合一',
    displayDescription: '境界突破后获得全属性提升',
  },

  // === 新增：风险收益类 ===
  {
    id: GONGFA_AFFIX_IDS.BERSERK_MODE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_BATTLE_START,
    paramsTemplate: {
      buffId: 'berserk',
      durationOverride: -1,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '真品',
    tags: ['primary', 'burst', 'offensive'],
    displayName: '狂战法',
    displayDescription: '战斗开始时获得狂暴状态（攻增防减）',
  },
  {
    id: GONGFA_AFFIX_IDS.SACRIFICE,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.15, scale: 'quality', coefficient: 0.05 },
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'burst', 'offensive'],
    displayName: '献祭术',
    displayDescription: '大幅提升灵力但降低体魄',
  },
];

export function getGongFaAffixPool() {
  return {
    primary: GONGFA_AFFIXES.filter((a) => a.tags?.includes('primary')),
    secondary: GONGFA_AFFIXES.filter((a) => a.tags?.includes('secondary')),
  };
}
