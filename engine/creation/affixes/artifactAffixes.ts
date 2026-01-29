/**
 * 法宝词条池配置
 *
 * 定义法宝可用的所有效果词条，分为：
 * - 主词条：属性加成（StatModifier）
 * - 副词条：特殊效果（暴击、吸血、减伤等）
 * - 诅咒词条：负面效果（五行相克时触发）
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

export const ARTIFACT_AFFIX_IDS = {
  // 主词条
  PRIMARY_VITALITY_FIXED: 'artifact_p_vitality_fixed',
  PRIMARY_SPIRIT_FIXED: 'artifact_p_spirit_fixed',
  PRIMARY_WISDOM_FIXED: 'artifact_p_wisdom_fixed',
  PRIMARY_SPEED_FIXED: 'artifact_p_speed_fixed',
  PRIMARY_WILLPOWER_FIXED: 'artifact_p_willpower_fixed',
  PRIMARY_VITALITY_PERCENT: 'artifact_p_vitality_percent',
  PRIMARY_SPIRIT_PERCENT: 'artifact_p_spirit_percent',
  // 副词条
  SECONDARY_CRIT_RATE: 'artifact_s_crit_rate',
  SECONDARY_CRIT_DAMAGE: 'artifact_s_crit_damage',
  SECONDARY_LIFESTEAL: 'artifact_s_lifesteal',
  SECONDARY_DAMAGE_REDUCTION: 'artifact_s_damage_reduction',
  SECONDARY_FLAT_REDUCTION: 'artifact_s_flat_reduction',
  SECONDARY_REFLECT_DAMAGE: 'artifact_s_reflect_damage',
  // SECONDARY_BURN_ON_HIT removed - uses ON_SKILL_HIT, not appropriate for passive artifacts
  // SECONDARY_POISON_ON_HIT removed - uses ON_SKILL_HIT, not appropriate for passive artifacts
  // SECONDARY_FREEZE_ON_HIT removed - uses ON_SKILL_HIT, not appropriate for passive artifacts
  SECONDARY_SHIELD: 'artifact_s_shield',
  SECONDARY_HIT_RATE: 'artifact_s_hit_rate',
  SECONDARY_DODGE_RATE: 'artifact_s_dodge_rate',
  SECONDARY_ELEMENT_DAMAGE: 'artifact_s_element_damage',
  SECONDARY_COUNTER_ATTACK: 'artifact_s_counter_attack',
  SECONDARY_EXECUTE_DAMAGE: 'artifact_s_execute_damage',
  SECONDARY_TRUE_DAMAGE: 'artifact_s_true_damage',
  SECONDARY_MANA_REGEN: 'artifact_s_mana_regen',
  SECONDARY_HOT: 'artifact_s_hot',
  SECONDARY_HEAL_AMPLIFY: 'artifact_s_heal_amplify',
  // 诅咒词条
  CURSE_DOT: 'artifact_c_dot',
  CURSE_SPIRIT_REDUCTION: 'artifact_c_spirit_reduction',
  CURSE_VITALITY_REDUCTION: 'artifact_c_vitality_reduction',
} as const;

// ============================================================
// 主词条池 - 属性加成
// ============================================================

const PRIMARY_AFFIXES: AffixWeight[] = [
  // 固定值属性加成
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_VITALITY_FIXED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: { base: 10, scale: 'quality', coefficient: 1.5 },
    },
    weight: 100,
    slots: ['weapon', 'armor', 'accessory'],
    tags: ['primary', 'defensive'],
    displayName: '体魄加成',
    displayDescription: '固定增加体魄，数值随境界提升',
  },
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_SPIRIT_FIXED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.FIXED,
      value: { base: 10, scale: 'quality', coefficient: 1.5 },
    },
    weight: 100,
    slots: ['weapon', 'armor', 'accessory'],
    tags: ['primary', 'offensive'],
    displayName: '灵力加成',
    displayDescription: '固定增加灵力，数值随境界提升',
  },
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_WISDOM_FIXED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.FIXED,
      value: { base: 8, scale: 'quality', coefficient: 1.2 },
    },
    weight: 80,
    slots: ['accessory'],
    tags: ['primary', 'utility'],
    displayName: '悟性加成',
    displayDescription: '固定增加悟性，数值随境界提升',
  },
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_SPEED_FIXED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.FIXED,
      value: { base: 8, scale: 'quality', coefficient: 1.2 },
    },
    weight: 80,
    slots: ['weapon', 'armor'],
    tags: ['primary', 'utility'],
    displayName: '速度加成',
    displayDescription: '固定增加速度，数值随境界提升',
  },
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_WILLPOWER_FIXED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.FIXED,
      value: { base: 8, scale: 'quality', coefficient: 1.2 },
    },
    weight: 80,
    slots: ['armor', 'accessory'],
    tags: ['primary', 'defensive'],
    displayName: '神识加成',
    displayDescription: '固定增加神识，数值随境界提升',
  },
  // 百分比属性加成（高品质专属）
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_VITALITY_PERCENT,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: { base: 0.05, scale: 'quality', coefficient: 1.5 },
    },
    weight: 30,
    slots: ['armor'],
    minQuality: '真品',
    tags: ['primary', 'defensive'],
    displayName: '体魄百分比加成',
    displayDescription: '百分比增加体魄，数值随品质提升',
  },
  {
    id: ARTIFACT_AFFIX_IDS.PRIMARY_SPIRIT_PERCENT,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.05, scale: 'quality', coefficient: 1.5 },
    },
    weight: 30,
    slots: ['weapon'],
    minQuality: '真品',
    tags: ['primary', 'offensive'],
    displayName: '灵力百分比加成',
    displayDescription: '百分比增加灵力，数值随品质提升',
  },
];

// ============================================================
// 副词条池 - 特殊效果
// ============================================================

const SECONDARY_AFFIXES: AffixWeight[] = [
  // 暴击相关
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_CRIT_RATE,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'critRate',
      modType: StatModifierType.PERCENT,
      value: { base: 0.05, scale: 'quality', coefficient: 1.2 },
    },
    weight: 50,
    slots: ['weapon', 'accessory'],
    minQuality: '真品',
    tags: ['secondary', 'offensive'],
    displayName: '暴击率提升',
    displayDescription: '提升暴击几率，数值随品质提升',
  },
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_CRIT_DAMAGE,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'critDamage',
      modType: StatModifierType.PERCENT,
      value: { base: 0.1, scale: 'quality', coefficient: 1.2 },
    },
    weight: 50,
    slots: ['weapon'],
    minQuality: '真品',
    tags: ['secondary', 'offensive'],
    displayName: '暴击伤害提升',
    displayDescription: '提升暴击伤害倍率，数值随品质提升',
  },
  // 吸血
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_LIFESTEAL,
    effectType: EffectType.LifeSteal,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      stealPercent: { base: 0.05, scale: 'quality', coefficient: 1.5 },
    },
    weight: 40,
    slots: ['weapon'],
    minQuality: '真品',
    tags: ['secondary', 'offensive', 'healing'],
    displayName: '吸血',
    displayDescription: '攻击时按伤害比例吸取生命',
  },
  // 减伤
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_DAMAGE_REDUCTION,
    effectType: EffectType.DamageReduction,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      percentReduction: { base: 0.05, scale: 'quality', coefficient: 1.5 },
      maxReduction: 0.5,
    },
    weight: 50,
    slots: ['armor'],
    minQuality: '玄品',
    tags: ['secondary', 'defensive'],
    displayName: '伤害减免',
    displayDescription: '按百分比减少受到的伤害',
  },
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_FLAT_REDUCTION,
    effectType: EffectType.DamageReduction,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      flatReduction: { base: 10, scale: 'quality', coefficient: 2 },
    },
    weight: 60,
    slots: ['armor'],
    tags: ['secondary', 'defensive'],
    displayName: '固定减伤',
    displayDescription: '固定减少受到的伤害，数值随境界提升',
  },
  // 反伤
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_REFLECT_DAMAGE,
    effectType: EffectType.ReflectDamage,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      reflectPercent: { base: 0.05, scale: 'quality', coefficient: 1.5 },
    },
    weight: 30,
    slots: ['armor'],
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '伤害反射',
    displayDescription: '将部分受到的伤害反弹给攻击者',
  },
  // 命中率/闪避率
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_HIT_RATE,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'hitRate',
      modType: StatModifierType.FIXED,
      value: { base: 0.03, scale: 'quality', coefficient: 1.5 },
    },
    weight: 40,
    slots: ['weapon', 'accessory'],
    tags: ['secondary', 'utility'],
    displayName: '命中率提升',
    displayDescription: '提升技能命中几率',
  },
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_DODGE_RATE,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'dodgeRate',
      modType: StatModifierType.FIXED,
      value: { base: 0.03, scale: 'quality', coefficient: 1.5 },
    },
    weight: 40,
    slots: ['armor', 'accessory'],
    tags: ['secondary', 'defensive'],
    displayName: '闪避率提升',
    displayDescription: '提升闪避敌方攻击的几率',
  },

  // ============================================================
  // P0/P1 新增战斗机制词条
  // ============================================================

  // 元素伤害加成 - 武器专属
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_ELEMENT_DAMAGE,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: 'INHERIT', // 继承法宝元素
      damageBonus: { base: 0.05, scale: 'quality', coefficient: 1.5 },
    },
    weight: 50,
    slots: ['weapon'],
    minQuality: '玄品',
    tags: ['secondary', 'offensive', 'fire_affinity', 'thunder_affinity'],
    displayName: '元素亲和',
    displayDescription: '增加对应元素的伤害加成',
  },

  // 斩杀伤害 - 武器专属
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_EXECUTE_DAMAGE,
    effectType: EffectType.ExecuteDamage,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      thresholdPercent: 0.3,
      bonusDamage: { base: 0.15, scale: 'quality', coefficient: 0.1 },
    },
    weight: 25,
    slots: ['weapon'],
    minQuality: '天品',
    tags: ['secondary', 'offensive', 'burst', 'execute'],
    displayName: '破军斩将',
    displayDescription: '对低生命值敌人造成额外伤害',
  },

  // 法力回复 - 饰品专属
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_MANA_REGEN,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.03, scale: 'quality', coefficient: 1.5 },
    },
    weight: 45,
    slots: ['accessory'],
    minQuality: '玄品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '灵枢引力',
    displayDescription: '每回合结束恢复法力',
  },

  // 持续回复 - 护甲专属
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_HOT,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      flatHeal: { base: 0.03, scale: 'quality', coefficient: 1.5 },
      targetSelf: true,
    },
    weight: 35,
    slots: ['armor'],
    minQuality: '真品',
    tags: ['secondary', 'sustain', 'defensive'],
    displayName: '生生不息',
    displayDescription: '每回合结束恢复生命',
  },

  // 治疗增幅 - 饰品专属
  {
    id: ARTIFACT_AFFIX_IDS.SECONDARY_HEAL_AMPLIFY,
    effectType: EffectType.HealAmplify,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      amplifyPercent: { base: 0.1, scale: 'quality', coefficient: 1.5 },
      affectOutgoing: false,
    },
    weight: 30,
    slots: ['accessory'],
    minQuality: '玄品',
    tags: ['secondary', 'sustain', 'healing_boost'],
    displayName: '妙手回春',
    displayDescription: '增加受到的治疗效果',
  },
];

// ============================================================
// 诅咒词条池 - 负面效果（五行相克触发）
// ============================================================

const CURSE_AFFIXES: AffixWeight[] = [
  // 使用消耗生命
  {
    id: ARTIFACT_AFFIX_IDS.CURSE_DOT,
    effectType: EffectType.DotDamage,
    trigger: EffectTrigger.ON_TURN_START,
    paramsTemplate: {
      baseDamage: { base: 5, scale: 'quality', coefficient: 1 },
      usesCasterStats: false,
    },
    weight: 100,
    tags: ['curse'],
    displayName: '反噬诅咒',
    displayDescription: '每回合受到反噬伤害',
  },
  // 属性削减
  {
    id: ARTIFACT_AFFIX_IDS.CURSE_SPIRIT_REDUCTION,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: -0.05,
    },
    weight: 80,
    tags: ['curse'],
    displayName: '灵力削减',
    displayDescription: '降低灵力',
  },
  {
    id: ARTIFACT_AFFIX_IDS.CURSE_VITALITY_REDUCTION,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: -0.05,
    },
    weight: 80,
    tags: ['curse'],
    displayName: '体魄削减',
    displayDescription: '降低5%体魄',
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
