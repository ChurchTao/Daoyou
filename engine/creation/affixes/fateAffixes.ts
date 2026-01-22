/**
 * 命格效果词条池配置
 *
 * 命格效果分为：
 * - 命格：包含属性增强、战斗增益以及特殊机制效果
 *
 * 与其他系统不同，命格效果是永久被动的
 */

import {
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { AffixWeight } from '../types';

// ============================================================
// 词条ID常量
// ============================================================

export const FATE_AFFIX_IDS = {
  // === 基础属性类 ===
  FATE_WISDOM: 'fate_stat_wisdom', // 天生道体
  FATE_VITALITY: 'fate_stat_vitality', // 荒古圣体
  FATE_SPIRIT: 'fate_stat_spirit', // 先天灵体
  FATE_SPEED: 'fate_stat_speed', // 风神腿
  FATE_WILLPOWER: 'fate_stat_willpower', // 强大神识
  FATE_CRIT: 'fate_stat_crit', // 鹰眼

  // === 战斗流派类 ===
  FATE_LIFESTEAL: 'fate_combat_lifesteal', // 嗜血
  FATE_THORNS: 'fate_combat_thorns', // 荆棘
  FATE_EXECUTE: 'fate_combat_execute', // 斩杀
  FATE_TANK: 'fate_combat_tank', // 不动如山
  FATE_ASSASSIN: 'fate_combat_assassin', // 刺客信条
  FATE_MANA_BATTERY: 'fate_combat_mana_battery', // 灵力源泉
  FATE_HEALER: 'fate_combat_healer', // 医圣转世
  FATE_MANA_DRAIN: 'fate_combat_mana_drain', // 噬灵
  FATE_DODGE: 'fate_combat_dodge', // 凌波微步

  // === 元素亲和类 ===
  FATE_FIRE_AFFINITY: 'fate_element_fire', // 火灵之体
  FATE_WATER_AFFINITY: 'fate_element_water', // 水灵之体
  FATE_WOOD_AFFINITY: 'fate_element_wood', // 木灵之体
  FATE_METAL_AFFINITY: 'fate_element_metal', // 金灵之体
  FATE_EARTH_AFFINITY: 'fate_element_earth', // 土灵之体
  FATE_WIND_AFFINITY: 'fate_element_wind', // 风灵之体
  FATE_THUNDER_AFFINITY: 'fate_element_thunder', // 雷灵之体
  FATE_ICE_AFFINITY: 'fate_element_ice', // 冰灵之体
} as const;

// ============================================================
// 命格词条池
// ============================================================

export const FATE_AFFIXES: AffixWeight[] = [
  // ========================================================
  // 1. 基础属性类 (Fundamental Paths)
  // ========================================================
  {
    id: FATE_AFFIX_IDS.FATE_WISDOM,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.PERCENT,
      value: { base: 0.15, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'stat', 'wisdom'],
    displayName: '天生道体',
    displayDescription: '悟性超群，大幅提升领悟能力与修炼速度',
  },
  {
    id: FATE_AFFIX_IDS.FATE_VITALITY,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.PERCENT,
      value: { base: 0.15, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'stat', 'vitality'],
    displayName: '荒古圣体',
    displayDescription: '体魄强健，气血雄厚，生存能力极强',
  },
  {
    id: FATE_AFFIX_IDS.FATE_SPIRIT,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.PERCENT,
      value: { base: 0.15, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'stat', 'spirit'],
    displayName: '先天灵体',
    displayDescription: '亲和灵力，法术威力和灵力上限大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_SPEED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.PERCENT,
      value: { base: 0.12, scale: 'quality', coefficient: 0.42 },
    },
    weight: 80,
    tags: ['primary', 'stat', 'speed'],
    displayName: '风神腿',
    displayDescription: '身法超绝，出手速度极快',
  },
  {
    id: FATE_AFFIX_IDS.FATE_WILLPOWER,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.PERCENT,
      value: { base: 0.15, scale: 'quality', coefficient: 0.5 },
    },
    weight: 80,
    tags: ['primary', 'stat', 'willpower'],
    displayName: '神识入微',
    displayDescription: '神识强大，能洞察先机，抵抗精神攻击',
  },
  {
    id: FATE_AFFIX_IDS.FATE_CRIT,
    effectType: EffectType.Critical,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      critRateBonus: { base: 0.08, scale: 'quality', coefficient: 0.25 },
      critDamageBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 70,
    minQuality: '真品',
    tags: ['secondary', 'offensive', 'crit'],
    displayName: '天生鹰眼',
    displayDescription: '目光如炬，更容易击中要害造成暴击',
  },

  // ========================================================
  // 2. 战斗流派类 (Combat Styles)
  // ========================================================
  {
    id: FATE_AFFIX_IDS.FATE_LIFESTEAL,
    effectType: EffectType.LifeSteal,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      stealPercent: { base: 0.08, scale: 'quality', coefficient: 0.94 },
    },
    weight: 60,
    minQuality: '地品',
    tags: ['secondary', 'combat', 'lifesteal'],
    displayName: '血魔转世',
    displayDescription: '攻击时汲取对方气血反哺自身',
  },
  {
    id: FATE_AFFIX_IDS.FATE_THORNS,
    effectType: EffectType.ReflectDamage,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      reflectPercent: { base: 0.15, scale: 'quality', coefficient: 0.5 },
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'combat', 'reflect'],
    displayName: '荆棘护体',
    displayDescription: '受击时反弹部分伤害给攻击者',
  },
  {
    id: FATE_AFFIX_IDS.FATE_EXECUTE,
    effectType: EffectType.ExecuteDamage,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      thresholdPercent: 0.3,
      bonusDamage: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 50,
    minQuality: '地品',
    tags: ['secondary', 'combat', 'execute'],
    displayName: '修罗杀道',
    displayDescription: '对重伤敌人（生命<30%）造成毁灭性打击',
  },
  {
    id: FATE_AFFIX_IDS.FATE_TANK,
    effectType: EffectType.DamageReduction,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      percentReduction: { base: 0.1, scale: 'quality', coefficient: 0.75 },
      maxReduction: 0.5,
    },
    weight: 70,
    minQuality: '真品',
    tags: ['secondary', 'combat', 'defense'],
    displayName: '不动明王',
    displayDescription: '肉身成圣，大幅减免受到的伤害',
  },
  {
    id: FATE_AFFIX_IDS.FATE_MANA_BATTERY,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.03, scale: 'quality', coefficient: 2.5 },
    },
    weight: 70,
    minQuality: '玄品',
    tags: ['secondary', 'combat', 'mana'],
    displayName: '灵力源泉',
    displayDescription: '体内灵力生生不息，每回合自动回复',
  },
  {
    id: FATE_AFFIX_IDS.FATE_HEALER,
    effectType: EffectType.HealAmplify,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      amplifyPercent: { base: 0.2, scale: 'quality', coefficient: 0.38 },
      affectOutgoing: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'combat', 'heal'],
    displayName: '医圣转世',
    displayDescription: '悬壶济世，施展的治疗效果大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_MANA_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.05, scale: 'quality', coefficient: 1.5 },
      restoreToSelf: true,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['secondary', 'combat', 'drain'],
    displayName: '噬灵邪体',
    displayDescription: '攻击时吞噬对方灵力，化为己用',
  },
  {
    id: FATE_AFFIX_IDS.FATE_DODGE,
    effectType: EffectType.ModifyHitRate,
    trigger: EffectTrigger.ON_CALC_HIT_RATE,
    paramsTemplate: {
      hitRateBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
      affectsTarget: true, // 增加自身闪避（即减少对方命中）
    },
    weight: 60,
    minQuality: '真品',
    tags: ['secondary', 'combat', 'dodge'],
    displayName: '凌波微步',
    displayDescription: '身形飘忽不定，大幅提升闪避率',
  },

  // ========================================================
  // 3. 元素亲和类 (Elemental Affinities)
  // ========================================================
  {
    id: FATE_AFFIX_IDS.FATE_FIRE_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '火',
      damageBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 40,
    tags: ['secondary', 'element', 'fire'],
    displayName: '火灵之体',
    displayDescription: '天生亲和火元素，火系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_WATER_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '水',
      damageBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 40,
    tags: ['secondary', 'element', 'water'],
    displayName: '水灵之体',
    displayDescription: '天生亲和水元素，水系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_WOOD_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '木',
      damageBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 40,
    tags: ['secondary', 'element', 'wood'],
    displayName: '木灵之体',
    displayDescription: '天生亲和木元素，木系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_METAL_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '金',
      damageBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 40,
    tags: ['secondary', 'element', 'metal'],
    displayName: '金灵之体',
    displayDescription: '天生亲和金元素，金系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_EARTH_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '土',
      damageBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
    },
    weight: 40,
    tags: ['secondary', 'element', 'earth'],
    displayName: '土灵之体',
    displayDescription: '天生亲和土元素，土系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_WIND_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '风',
      damageBonus: { base: 0.25, scale: 'quality', coefficient: 0.3 },
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'element', 'wind'],
    displayName: '风灵之体',
    displayDescription: '天生亲和风元素，风系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_THUNDER_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '雷',
      damageBonus: { base: 0.25, scale: 'quality', coefficient: 0.3 },
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'element', 'thunder'],
    displayName: '雷灵之体',
    displayDescription: '天生亲和雷元素，雷系伤害大幅提升',
  },
  {
    id: FATE_AFFIX_IDS.FATE_ICE_AFFINITY,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      element: '冰',
      damageBonus: { base: 0.25, scale: 'quality', coefficient: 0.3 },
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'element', 'ice'],
    displayName: '冰灵之体',
    displayDescription: '天生亲和冰元素，冰系伤害大幅提升',
  },
];
