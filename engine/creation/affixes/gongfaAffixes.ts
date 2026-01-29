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

  // 新增：吸血系 (removed - using ON_SKILL_HIT, not appropriate for passive gongfa)

  // 新增：法力系 (removed MANA_FOCUS - using ON_CONSUME, not appropriate for gongfa)
  BREAKTHROUGH_MANA: 'gongfa_breakthrough_mana',

  // 新增：元素系(金、木、水、火、雷、风、土、冰)
  FIRE_ESSENCE: 'gongfa_fire_essence',
  THUNDER_ESSENCE: 'gongfa_thunder_essence',
  ICE_ESSENCE: 'gongfa_ice_essence',
  WIND_ESSENCE: 'gongfa_wind_essence',
  EARTH_ESSENCE: 'gongfa_earth_essence',
  METAL_ESSENCE: 'gongfa_metal_essence',
  WOOD_ESSENCE: 'gongfa_wood_essence',

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
      value: { base: 0.1, scale: 'quality', coefficient: 0.75 },
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
      value: { base: 0.1, scale: 'quality', coefficient: 0.75 },
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
      value: { base: 0.1, scale: 'quality', coefficient: 0.75 },
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
      value: { base: 0.08, scale: 'quality', coefficient: 0.47 },
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
      value: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 80,
    tags: ['primary', 'defensive'],
    displayName: '炼神诀',
    displayDescription: '锤炼神识，大幅提升神识',
  },

  // === 战斗属性 ===
  {
    id: GONGFA_AFFIX_IDS.CRIT_RATE_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'critRate',
      modType: StatModifierType.PERCENT,
      value: { base: 0.2, scale: 'quality', coefficient: 0.5 },
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '凝元功',
    displayDescription: '提升暴击率',
  },
  {
    id: GONGFA_AFFIX_IDS.CRIT_DMG_BOOST,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'critDamage',
      modType: StatModifierType.PERCENT,
      value: { base: 0.3, scale: 'quality', coefficient: 0.5 },
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '暴击伤害',
    displayDescription: '提升暴击伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.DMG_REDUCTION,
    effectType: EffectType.DamageReduction,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      percentReduction: { base: 0.05, scale: 'quality', coefficient: 0.75 },
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
      percentOfMax: { base: 0.01, scale: 'quality', coefficient: 0.75 },
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
    trigger: EffectTrigger.ON_BATTLE_START,
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
    id: GONGFA_AFFIX_IDS.MIRROR_ART,
    effectType: EffectType.ReflectDamage,
    trigger: EffectTrigger.ON_BEING_HIT,
    paramsTemplate: {
      reflectPercent: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '镜像诀',
    displayDescription: '被攻击时反弹伤害',
  },

  // === 新增：元素系 ===
  {
    id: GONGFA_AFFIX_IDS.FIRE_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '火',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
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
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '雷神诀',
    displayDescription: '提升雷属性技能伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.ICE_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '冰',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '冰魄诀',
    displayDescription: '提升冰属性技能伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.WIND_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '风',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '风之精髓',
    displayDescription: '提升风属性技能伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.EARTH_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '土',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '地之精髓',
    displayDescription: '提升土属性技能伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.METAL_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '金',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '金之精髓',
    displayDescription: '提升金属性技能伤害',
  },
  {
    id: GONGFA_AFFIX_IDS.WOOD_ESSENCE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: '木',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '木之精髓',
    displayDescription: '提升木属性技能伤害',
  },
];

export function getGongFaAffixPool() {
  return {
    primary: GONGFA_AFFIXES.filter((a) => a.tags?.includes('primary')),
    secondary: GONGFA_AFFIXES.filter((a) => a.tags?.includes('secondary')),
  };
}
