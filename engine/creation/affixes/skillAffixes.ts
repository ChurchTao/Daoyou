/**
 * 神通词条池配置
 *
 * 神通效果根据技能类型分类：
 * - attack: 攻击型 - 伤害效果
 * - heal: 治疗型 - 治疗/护盾效果
 * - control: 控制型 - 眩晕/冰冻等控制效果
 * - debuff: 减益型 - 虚弱/中毒等减益效果
 * - buff: 增益型 - 攻击/防御增益
 */

import {
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { SkillType } from '@/types/constants';
import type { AffixWeight } from '../types';

// ============================================================
// 词条ID常量
// ============================================================

export const SKILL_AFFIX_IDS = {
  // 攻击型主词条
  ATTACK_BASE_DAMAGE: 'skill_attack_base_damage',
  ATTACK_HEAVY_DAMAGE: 'skill_attack_heavy_damage',
  ATTACK_CRIT_DAMAGE: 'skill_attack_crit_damage',
  ATTACK_ARMOR_PIERCE: 'skill_attack_armor_pierce',
  ATTACK_EXECUTE: 'skill_attack_execute',
  ATTACK_TRUE_DAMAGE: 'skill_attack_true_damage',
  // 攻击型主词条（新增）
  ATTACK_MULTI_HIT: 'skill_attack_multi_hit',
  ATTACK_DESTRUCTIVE: 'skill_attack_destructive',
  ATTACK_STORM: 'skill_attack_storm',
  ATTACK_THUNDER: 'skill_attack_thunder',
  ATTACK_LIFESTEAL: 'skill_attack_lifesteal',
  ATTACK_BLOOD_FEAST: 'skill_attack_blood_feast',
  ATTACK_COUNTER: 'skill_attack_counter',
  ATTACK_MIRROR_COUNTER: 'skill_attack_mirror_counter',
  ATTACK_FIRE: 'skill_attack_fire',
  ATTACK_THUNDER_BOLT: 'skill_attack_thunder_bolt',
  ATTACK_ICE: 'skill_attack_ice',
  // 攻击型副词条（新增）
  ATTACK_S_ELEMENT_BONUS: 'skill_attack_s_element_bonus',
  ATTACK_S_CRITICAL: 'skill_attack_s_critical',
  ATTACK_S_PENETRATE: 'skill_attack_s_penetrate',
  ATTACK_S_MANA_DRAIN: 'skill_attack_s_mana_drain',

  // 治疗型主词条
  HEAL_BASE: 'skill_heal_base',
  HEAL_STRONG: 'skill_heal_strong',
  HEAL_WITH_SHIELD: 'skill_heal_with_shield',
  // 治疗型主词条（新增）
  HEAL_REGENERATION: 'skill_heal_regeneration',
  HEAL_SPRING: 'skill_heal_spring',
  HEAL_ENLIGHTENMENT: 'skill_heal_enlightenment',
  HEAL_SHIELD_ONLY: 'skill_heal_shield_only',
  HEAL_HOLY_SHIELD: 'skill_heal_holy_shield',
  HEAL_DISPEL_HEAL: 'skill_heal_dispel_heal',
  HEAL_PURIFY: 'skill_heal_purify',
  // 治疗型副词条
  HEAL_S_SHIELD: 'skill_heal_s_shield',
  HEAL_S_HOT: 'skill_heal_s_hot',
  HEAL_S_DISPEL: 'skill_heal_s_dispel',
  HEAL_S_AMPLIFY: 'skill_heal_s_amplify',
  // 治疗型副词条（新增）
  HEAL_S_AMPLIFY_PASSIVE: 'skill_heal_s_amplify_passive',
  HEAL_S_RECOVERY: 'skill_heal_s_recovery',
  HEAL_S_EMERGENCY: 'skill_heal_s_emergency',
  HEAL_S_MANA_REGEN: 'skill_heal_s_mana_regen',

  // 控制型主词条
  CONTROL_STUN: 'skill_control_stun',
  CONTROL_FREEZE: 'skill_control_freeze',
  CONTROL_ROOT: 'skill_control_root',
  CONTROL_SILENCE: 'skill_control_silence',
  // 控制型主词条（新增）
  CONTROL_SLOW: 'skill_control_slow',
  CONTROL_WEAKNESS: 'skill_control_weakness',
  CONTROL_SEAL: 'skill_control_seal',
  CONTROL_BIND: 'skill_control_bind',
  CONTROL_ICE_TRAP: 'skill_control_ice_trap',
  CONTROL_THUNDER_SHOCK: 'skill_control_thunder_shock',
  CONTROL_ICE_FREEZE_BURN: 'skill_control_ice_freeze_burn',
  CONTROL_THUNDER_ROOT: 'skill_control_thunder_root',
  CONTROL_BIND_STUN: 'skill_control_bind_stun',
  CONTROL_SEAL_DRAIN: 'skill_control_seal_drain',
  CONTROL_SHOCK_WEAKEN: 'skill_control_shock_weaken',
  // 控制型副词条
  CONTROL_S_DAMAGE: 'skill_control_s_damage',
  CONTROL_S_MANA_DRAIN: 'skill_control_s_mana_drain',
  // 控制型副词条（新增）
  CONTROL_S_EXTENDED: 'skill_control_s_extended',
  CONTROL_S_COMBO: 'skill_control_s_combo',
  CONTROL_S_BREAK: 'skill_control_s_break',

  // 减益型主词条
  DEBUFF_WEAKNESS: 'skill_debuff_weakness',
  DEBUFF_POISON: 'skill_debuff_poison',
  DEBUFF_BURN: 'skill_debuff_burn',
  DEBUFF_BLEED: 'skill_debuff_bleed',
  // 减益型主词条（新增）
  DEBUFF_CORROSION: 'skill_debuff_corrosion',
  DEBUFF_ARMOR_BREAK: 'skill_debuff_armor_break',
  DEBUFF_SUPPRESS: 'skill_debuff_suppress',
  DEBUFF_ARMOR_SHRED: 'skill_debuff_armor_shred',
  DEBUFF_SEAL_VEIN: 'skill_debuff_seal_vein',
  DEBUFF_POWER_SCATTER: 'skill_debuff_power_scatter',
  DEBUFF_POISON_WEAK: 'skill_debuff_poison_weak',
  DEBUFF_BURN_REDUCTION: 'skill_debuff_burn_reduction',
  DEBUFF_BLEED_ARMOR: 'skill_debuff_bleed_armor',
  DEBUFF_SEAL_DRAIN: 'skill_debuff_seal_drain',
  DEBUFF_WEAKNESS_SLOW: 'skill_debuff_weakness_slow',
  // 减益型副词条
  DEBUFF_S_DAMAGE: 'skill_debuff_s_damage',
  // 减益型副词条（新增）
  DEBUFF_S_EXTENDED: 'skill_debuff_extended',
  DEBUFF_S_DOUBLE: 'skill_debuff_s_double',
  DEBUFF_S_ENHANCED: 'skill_debuff_s_enhanced',
  DEBUFF_S_ARMOR_BREAK: 'skill_debuff_s_armor_break',

  // 增益型主词条
  BUFF_SPIRIT: 'skill_buff_spirit',
  BUFF_VITALITY: 'skill_buff_vitality',
  BUFF_SPEED: 'skill_buff_speed',
  BUFF_CRIT: 'skill_buff_crit',
  // 增益型主词条（新增）
  BUFF_ARMOR: 'skill_buff_armor',
  BUFF_ALL_STATS: 'skill_buff_all_stats',
  BUFF_BERSERK: 'skill_buff_berserk',
  BUFF_IRON_WALL: 'skill_buff_iron_wall',
  BUFF_SWIFT: 'skill_buff_swift',
  BUFF_WAR_INTENT: 'skill_buff_war_intent',
  BUFF_TURTLE: 'skill_buff_turtle',
  BUFF_DIVINE: 'skill_buff_divine',
  BUFF_IMMORTAL: 'skill_buff_immortal',
  BUFF_DESPERATE: 'skill_buff_desperate',
  BUFF_ENLIGHTENMENT: 'skill_buff_enlightenment',
  BUFF_ELEMENT_SHIELD: 'skill_buff_element_shield',
  BUFF_COUNTER_STANCE: 'skill_buff_counter_stance',
  BUFF_MANA_BODY: 'skill_buff_mana_body',
  BUFF_DIVINE_DESCENT: 'skill_buff_divine_descent',
  BUFF_GOD_SPEED: 'skill_buff_god_speed',
  // 增益型副词条
  BUFF_S_SHIELD: 'skill_buff_s_shield',
  BUFF_S_HEAL: 'skill_buff_s_heal',
  BUFF_S_MANA_REGEN: 'skill_buff_s_mana_regen',
  // 增益型副词条（新增）
  BUFF_S_EXTENDED: 'skill_buff_s_extended',
  BUFF_S_DOUBLE: 'skill_buff_s_double',
  BUFF_S_EMERGENCY: 'skill_buff_s_emergency',
  BUFF_S_MANA: 'skill_buff_s_mana',
  BUFF_S_REFLECT: 'skill_buff_s_reflect',
  BUFF_S_RECOVER: 'skill_buff_s_recover',
  BUFF_S_SELF_HEAL: 'skill_buff_s_self_heal',
} as const;

// ============================================================
// 攻击型技能词条
// ============================================================

const ATTACK_AFFIXES: AffixWeight[] = [
  // 基础伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_BASE_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.0, scale: 'root', coefficient: 0.5 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '基础伤害',
    displayDescription: '造成基础伤害，可暴击，数值随悟性提升',
  },
  // 高倍率伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_HEAVY_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.5, scale: 'root', coefficient: 0.8 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 50,
    minQuality: '玄品',
    tags: ['primary', 'offensive'],
    displayName: '重伤害',
    displayDescription: '造成高倍率伤害，可暴击，数值随悟性提升',
  },
  // 暴击加成伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_CRIT_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.2, scale: 'root', coefficient: 0.6 },
      element: 'INHERIT',
      canCrit: true,
      critRateBonus: { base: 0.15, scale: 'quality', coefficient: 0.38 },
    },
    weight: 40,
    minQuality: '真品',
    tags: ['primary', 'offensive'],
    displayName: '致命一击',
    displayDescription: '造成伤害并提高暴击率，暴击率随品质提升',
  },
  // 无视防御伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_ARMOR_PIERCE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.8, scale: 'root', coefficient: 0.4 },
      element: 'INHERIT',
      canCrit: true,
      ignoreDefense: true,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['primary', 'offensive'],
    displayName: '破甲攻击',
    displayDescription: '造成无视防御的伤害',
  },
  // 斩杀伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_EXECUTE,
    effectType: EffectType.ExecuteDamage,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      thresholdPercent: 0.3,
      bonusDamage: { base: 0.2, scale: 'root', coefficient: 0.1 },
    },
    weight: 20,
    minQuality: '地品',
    tags: ['secondary', 'offensive', 'burst', 'execute'],
    displayName: '斩杀',
    displayDescription: '对低于30%生命值的敌人造成额外伤害',
  },
  // 真实伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_TRUE_DAMAGE,
    effectType: EffectType.TrueDamage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      baseDamage: { base: 50, scale: 'root', coefficient: 15 },
      ignoreShield: true,
      ignoreReduction: true,
    },
    weight: 15,
    minQuality: '天品',
    tags: ['secondary', 'offensive', 'burst', 'true_damage'],
    displayName: '诛仙剑气',
    displayDescription: '造成无视护盾和减伤的真实伤害',
  },
  // === 新增攻击型主词条 ===
  // 连续攻击
  {
    id: SKILL_AFFIX_IDS.ATTACK_MULTI_HIT,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.5, scale: 'root', coefficient: 0.2 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 40,
    minQuality: '玄品',
    tags: ['primary', 'offensive'],
    displayName: '连斩',
    displayDescription: '连续攻击，每次造成较低伤害',
  },
  // 破灭一击
  {
    id: SKILL_AFFIX_IDS.ATTACK_DESTRUCTIVE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.3, scale: 'root', coefficient: 0.7 },
      element: 'INHERIT',
      canCrit: true,
      critDamageBonus: { base: 0.3, scale: 'quality', coefficient: 0.38 },
    },
    weight: 30,
    minQuality: '地品',
    tags: ['primary', 'offensive', 'burst'],
    displayName: '破灭一击',
    displayDescription: '高暴击伤害的致命一击',
  },
  // 暴风斩
  {
    id: SKILL_AFFIX_IDS.ATTACK_STORM,
    effectType: EffectType.BonusDamage,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      multiplier: { base: 0.3, scale: 'root', coefficient: 0.15 },
      element: 'INHERIT',
      canCrit: false,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'offensive'],
    displayName: '暴风斩',
    displayDescription: '造成伤害后附加额外伤害',
  },
  // 雷霆万钧
  {
    id: SKILL_AFFIX_IDS.ATTACK_THUNDER,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.0, scale: 'root', coefficient: 0.5 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'offensive'],
    displayName: '雷霆万钧',
    displayDescription: '造成伤害并降低敌人速度',
  },
  // 吸血斩
  {
    id: SKILL_AFFIX_IDS.ATTACK_LIFESTEAL,
    effectType: EffectType.LifeSteal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      stealPercent: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'lifesteal', 'sustain'],
    displayName: '吸血斩',
    displayDescription: '攻击时回复生命值',
  },
  // 鲜血盛宴
  {
    id: SKILL_AFFIX_IDS.ATTACK_BLOOD_FEAST,
    effectType: EffectType.LifeSteal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      stealPercent: { base: 0.2, scale: 'quality', coefficient: 0.75 },
    },
    weight: 20,
    minQuality: '天品',
    tags: ['secondary', 'lifesteal', 'burst'],
    displayName: '鲜血盛宴',
    displayDescription: '高吸血但降低防御',
  },
  // 反击波
  {
    id: SKILL_AFFIX_IDS.ATTACK_COUNTER,
    effectType: EffectType.CounterAttack,
    trigger: EffectTrigger.ON_BEING_HIT,
    paramsTemplate: {
      chance: { base: 0.3, scale: 'quality', coefficient: 0.05 },
      damageMultiplier: { base: 0.4, scale: 'quality', coefficient: 0.1 },
      element: 'INHERIT',
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'counter'],
    displayName: '反击波',
    displayDescription: '被攻击时有一定几率反击',
  },
  // 镜像反杀
  {
    id: SKILL_AFFIX_IDS.ATTACK_MIRROR_COUNTER,
    effectType: EffectType.CounterAttack,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      chance: 1.0,
      damageMultiplier: { base: 0.3, scale: 'quality', coefficient: 0.1 },
      element: 'INHERIT',
    },
    weight: 20,
    minQuality: '天品',
    tags: ['secondary', 'counter'],
    displayName: '镜像反杀',
    displayDescription: '受到伤害后必定反击',
  },
  // 烈焰冲击
  {
    id: SKILL_AFFIX_IDS.ATTACK_FIRE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.0, scale: 'root', coefficient: 0.5 },
      element: '火',
      canCrit: true,
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'offensive'],
    displayName: '烈焰冲击',
    displayDescription: '火属性攻击，可能附加灼烧',
  },
  // 雷霆突袭
  {
    id: SKILL_AFFIX_IDS.ATTACK_THUNDER_BOLT,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 1.1, scale: 'root', coefficient: 0.55 },
      element: '雷',
      canCrit: true,
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'offensive'],
    displayName: '雷霆突袭',
    displayDescription: '雷属性攻击，可能麻痹',
  },
  // 寒冰剑气
  {
    id: SKILL_AFFIX_IDS.ATTACK_ICE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'freeze',
      chance: { base: 0.3, scale: 'quality', coefficient: 0.05 },
      durationOverride: 1,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'control'],
    displayName: '寒冰剑气',
    displayDescription: '冰属性攻击，可能冰冻敌人',
  },
];

// 攻击型副词条
const ATTACK_SECONDARY_AFFIXES: AffixWeight[] = [
  // 元素亲和
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_ELEMENT_BONUS,
    effectType: EffectType.ElementDamageBonus,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      element: 'INHERIT',
      damageBonus: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 40,
    minQuality: '玄品',
    tags: ['secondary', 'offensive'],
    displayName: '元素亲和',
    displayDescription: '提升对应元素技能的伤害',
  },
  // 暴击要害
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_CRITICAL,
    effectType: EffectType.Critical,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      critRateBonus: { base: 0.08, scale: 'quality', coefficient: 0.38 },
      critDamageBonus: { base: 0.15, scale: 'quality', coefficient: 0.38 },
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'burst'],
    displayName: '暴击要害',
    displayDescription: '提升暴击率和暴击伤害',
  },
  // 穿透攻击
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_PENETRATE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.5, scale: 'root', coefficient: 0.25 },
      element: 'INHERIT',
      canCrit: true,
      ignoreDefense: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'offensive'],
    displayName: '穿透攻击',
    displayDescription: '部分伤害无视防御',
  },
  // 法力吸取
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_MANA_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.08, scale: 'quality', coefficient: 0.75 },
      restoreToSelf: true,
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'sustain'],
    displayName: '法力吸取',
    displayDescription: '攻击时吸取法力值',
  },
];

// ============================================================
// 治疗型技能词条
// ============================================================

const HEAL_AFFIXES: AffixWeight[] = [
  // 基础治疗
  {
    id: SKILL_AFFIX_IDS.HEAL_BASE,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.5, scale: 'root', coefficient: 0.3 },
      targetSelf: true,
    },
    weight: 100,
    tags: ['primary', 'healing'],
    displayName: '基础治疗',
    displayDescription: '恢复自身生命值，数值随悟性提升',
  },
  // 高效治疗
  {
    id: SKILL_AFFIX_IDS.HEAL_STRONG,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.8, scale: 'root', coefficient: 0.5 },
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['primary', 'healing'],
    displayName: '强效治疗',
    displayDescription: '大量恢复自身生命值，数值随悟性提升',
  },
  // 治疗 + 护盾
  {
    id: SKILL_AFFIX_IDS.HEAL_WITH_SHIELD,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.4, scale: 'root', coefficient: 0.2 },
      targetSelf: true,
    },
    weight: 40,
    minQuality: '玄品',
    tags: ['primary', 'healing'],
    displayName: '治疗护体',
    displayDescription: '恢复生命值并附带防护效果',
  },
  // === 新增治疗型主词条 ===
  // 再生术
  {
    id: SKILL_AFFIX_IDS.HEAL_REGENERATION,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'regeneration',
      durationOverride: 4,
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['primary', 'healing'],
    displayName: '再生术',
    displayDescription: '获得持续回复状态',
  },
  // 生命之泉
  {
    id: SKILL_AFFIX_IDS.HEAL_SPRING,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      multiplier: { base: 0.3, scale: 'root', coefficient: 0.15 },
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['primary', 'healing'],
    displayName: '生命之泉',
    displayDescription: '持续数回合恢复生命值',
  },
  // 回春诀
  {
    id: SKILL_AFFIX_IDS.HEAL_ENLIGHTENMENT,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.6, scale: 'root', coefficient: 0.35 },
      targetSelf: true,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['primary', 'healing'],
    displayName: '回春诀',
    displayDescription: '增强治疗效果',
  },
  // 灵护
  {
    id: SKILL_AFFIX_IDS.HEAL_SHIELD_ONLY,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 100, scale: 'root', coefficient: 4 },
      duration: 3,
    },
    weight: 35,
    minQuality: '真品',
    tags: ['primary', 'defensive'],
    displayName: '灵护',
    displayDescription: '获得护盾保护',
  },
  // 圣光护盾
  {
    id: SKILL_AFFIX_IDS.HEAL_HOLY_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 80, scale: 'root', coefficient: 3 },
      duration: 3,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['primary', 'defensive'],
    displayName: '圣光护盾',
    displayDescription: '获得护盾和额外buff',
  },
  // 妙手回春（治疗+驱散）
  {
    id: SKILL_AFFIX_IDS.HEAL_DISPEL_HEAL,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.5, scale: 'root', coefficient: 0.25 },
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['primary', 'healing'],
    displayName: '妙手回春',
    displayDescription: '治疗并驱散负面状态',
  },
  // 驱邪术
  {
    id: SKILL_AFFIX_IDS.HEAL_PURIFY,
    effectType: EffectType.Dispel,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      dispelCount: 2,
      dispelType: 'debuff',
      targetSelf: true,
    },
    weight: 40,
    minQuality: '真品',
    tags: ['primary', 'dispel'],
    displayName: '驱邪术',
    displayDescription: '驱散多个负面状态',
  },
];

const HEAL_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附加护盾
  {
    id: SKILL_AFFIX_IDS.HEAL_S_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 50, scale: 'root', coefficient: 2 },
      duration: 2,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'defensive'],
    displayName: '附加护盾',
    displayDescription: '治疗时额外获得护盾',
  },
  // 持续回复
  {
    id: SKILL_AFFIX_IDS.HEAL_S_HOT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'regeneration',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 40,
    minQuality: '真品',
    tags: ['secondary', 'healing'],
    displayName: '持续回复',
    displayDescription: '获得持续回复状态，每回合恢复生命',
  },
  // 驱散负面状态
  {
    id: SKILL_AFFIX_IDS.HEAL_S_DISPEL,
    effectType: EffectType.Dispel,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      dispelCount: 1,
      dispelType: 'debuff',
      targetSelf: true,
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'sustain', 'dispel'],
    displayName: '妙手回春',
    displayDescription: '治疗时驱散一个负面状态',
  },
  // 治疗增幅
  {
    id: SKILL_AFFIX_IDS.HEAL_S_AMPLIFY,
    effectType: EffectType.HealAmplify,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      amplifyPercent: { base: 0.15, scale: 'root', coefficient: 0.05 },
      affectOutgoing: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'healing_boost'],
    displayName: '木灵护体',
    displayDescription: '增强治疗效果',
  },
  // === 新增治疗型副词条 ===
  // 治疗增幅被动
  {
    id: SKILL_AFFIX_IDS.HEAL_S_AMPLIFY_PASSIVE,
    effectType: EffectType.HealAmplify,
    trigger: EffectTrigger.ON_STAT_CALC,
    paramsTemplate: {
      amplifyPercent: { base: 0.1, scale: 'quality', coefficient: 0.75 },
      affectOutgoing: true,
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'healing_boost'],
    displayName: '治疗增幅',
    displayDescription: '提升治疗效果',
  },
  // 复苏之风
  {
    id: SKILL_AFFIX_IDS.HEAL_S_RECOVERY,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      multiplier: { base: 0.15, scale: 'root', coefficient: 0.05 },
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'healing'],
    displayName: '复苏之风',
    displayDescription: '受到治疗时额外回复',
  },
  // 急救
  {
    id: SKILL_AFFIX_IDS.HEAL_S_EMERGENCY,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_TURN_START,
    paramsTemplate: {
      multiplier: { base: 1.0, scale: 'root', coefficient: 0.5 },
      targetSelf: true,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'healing', 'burst'],
    displayName: '急救',
    displayDescription: '低血量时触发高倍率治疗',
  },
  // 灵枢引力
  {
    id: SKILL_AFFIX_IDS.HEAL_S_MANA_REGEN,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.05, scale: 'quality', coefficient: 0.75 },
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '灵枢引力',
    displayDescription: '每回合恢复法力值',
  },
];

// ============================================================
// 控制型技能词条
// ============================================================

const CONTROL_AFFIXES: AffixWeight[] = [
  // 眩晕
  {
    id: SKILL_AFFIX_IDS.CONTROL_STUN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'stun',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.1 },
      durationOverride: 1,
    },
    weight: 100,
    tags: ['primary', 'control'],
    displayName: '眩晕',
    displayDescription: '有几率使敌人眩晕1回合',
  },
  // 冰冻
  {
    id: SKILL_AFFIX_IDS.CONTROL_FREEZE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'freeze',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 80,
    tags: ['primary', 'control'],
    displayName: '冰冻',
    displayDescription: '有几率冰冻敌人2回合',
  },
  // 定身
  {
    id: SKILL_AFFIX_IDS.CONTROL_ROOT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'root',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 70,
    tags: ['primary', 'control'],
    displayName: '定身',
    displayDescription: '有几率定身敌人2回合',
  },
  // 沉默
  {
    id: SKILL_AFFIX_IDS.CONTROL_SILENCE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'silence',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 60,
    tags: ['primary', 'control'],
    displayName: '沉默',
    displayDescription: '有几率沉默敌人2回合',
  },
  // === 新增控制型主词条 ===
  // 迟缓术
  {
    id: SKILL_AFFIX_IDS.CONTROL_SLOW,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'slow',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 60,
    tags: ['primary', 'control'],
    displayName: '迟缓术',
    displayDescription: '有几率降低敌人速度',
  },
  // 虚弱咒
  {
    id: SKILL_AFFIX_IDS.CONTROL_WEAKNESS,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 50,
    minQuality: '玄品',
    tags: ['primary', 'debuff'],
    displayName: '虚弱咒',
    displayDescription: '有几率降低敌人全属性',
  },
  // 封印术
  {
    id: SKILL_AFFIX_IDS.CONTROL_SEAL,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'silence',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 50,
    minQuality: '地品',
    tags: ['primary', 'control'],
    displayName: '封印术',
    displayDescription: '沉默并降低属性',
  },
  // 束缚法
  {
    id: SKILL_AFFIX_IDS.CONTROL_BIND,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'root',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 45,
    minQuality: '地品',
    tags: ['primary', 'control'],
    displayName: '束缚法',
    displayDescription: '定身并持续伤害',
  },
  // 寒冰陷阱
  {
    id: SKILL_AFFIX_IDS.CONTROL_ICE_TRAP,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'freeze',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['primary', 'control'],
    displayName: '寒冰陷阱',
    displayDescription: '冰冻并降低速度',
  },
  // 雷击
  {
    id: SKILL_AFFIX_IDS.CONTROL_THUNDER_SHOCK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'stun',
      chance: { base: 0.4, scale: 'quality', coefficient: 0.05 },
      durationOverride: 1,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['primary', 'control'],
    displayName: '雷击',
    displayDescription: '眩晕并附加伤害',
  },
  // 冰封千里
  {
    id: SKILL_AFFIX_IDS.CONTROL_ICE_FREEZE_BURN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'freeze',
      chance: { base: 0.4, scale: 'quality', coefficient: 0.05 },
      durationOverride: 1,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'control'],
    displayName: '冰封千里',
    displayDescription: '冰冻并附加DOT',
  },
  // 雷锁
  {
    id: SKILL_AFFIX_IDS.CONTROL_THUNDER_ROOT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'root',
      chance: { base: 0.4, scale: 'quality', coefficient: 0.05 },
      durationOverride: 1,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'control'],
    displayName: '雷锁',
    displayDescription: '定身并沉默',
  },
  // 禁锢术
  {
    id: SKILL_AFFIX_IDS.CONTROL_BIND_STUN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'stun',
      chance: { base: 0.35, scale: 'quality', coefficient: 0.05 },
      durationOverride: 1,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['primary', 'control'],
    displayName: '禁锢术',
    displayDescription: '定身并眩晕',
  },
  // 封神禁
  {
    id: SKILL_AFFIX_IDS.CONTROL_SEAL_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.1, scale: 'quality', coefficient: 0.75 },
      restoreToSelf: true,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['primary', 'control'],
    displayName: '封神禁',
    displayDescription: '沉默并吸取法力',
  },
  // 震慑
  {
    id: SKILL_AFFIX_IDS.CONTROL_SHOCK_WEAKEN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'stun',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.05 },
      durationOverride: 1,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['primary', 'control'],
    displayName: '震慑',
    displayDescription: '眩晕并降低防御',
  },
];

const CONTROL_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附带伤害
  {
    id: SKILL_AFFIX_IDS.CONTROL_S_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.4, scale: 'root', coefficient: 0.2 },
      element: 'INHERIT',
      canCrit: false,
    },
    weight: 50,
    tags: ['secondary', 'offensive'],
    displayName: '附带伤害',
    displayDescription: '控制技能附带少量伤害',
  },
  // 法力吸取
  {
    id: SKILL_AFFIX_IDS.CONTROL_S_MANA_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.1, scale: 'quality', coefficient: 0.75 },
      restoreToSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'control', 'sustain'],
    displayName: '封魂禁言',
    displayDescription: '吸取敌人法力值',
  },
  // === 新增控制型副词条 ===
  // 控制强化
  {
    id: SKILL_AFFIX_IDS.CONTROL_S_EXTENDED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'INHERIT',
      durationOverride: 3,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'control'],
    displayName: '控制强化',
    displayDescription: '延长控制时间',
  },
  // 控制连环
  {
    id: SKILL_AFFIX_IDS.CONTROL_S_COMBO,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'INHERIT',
      durationOverride: 1,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['secondary', 'control'],
    displayName: '控制连环',
    displayDescription: '控制效果叠加',
  },
  // 破防控制
  {
    id: SKILL_AFFIX_IDS.CONTROL_S_BREAK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'armor_down',
      durationOverride: 2,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'debuff'],
    displayName: '破防控制',
    displayDescription: '控制同时降低防御',
  },
];

// ============================================================
// 减益型技能词条
// ============================================================

const DEBUFF_AFFIXES: AffixWeight[] = [
  // 虚弱
  {
    id: SKILL_AFFIX_IDS.DEBUFF_WEAKNESS,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 3,
    },
    weight: 100,
    tags: ['primary', 'debuff'],
    displayName: '虚弱',
    displayDescription: '有几率使敌人进入虚弱状态',
  },
  // 中毒
  {
    id: SKILL_AFFIX_IDS.DEBUFF_POISON,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'poison',
      chance: { base: 0.8, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 90,
    tags: ['primary', 'debuff', 'dot'],
    displayName: '中毒',
    displayDescription: '有几率使敌人中毒，持续造成伤害',
  },
  // 灼烧
  {
    id: SKILL_AFFIX_IDS.DEBUFF_BURN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'burn',
      chance: { base: 0.8, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 90,
    tags: ['primary', 'debuff', 'dot'],
    displayName: '灼烧',
    displayDescription: '有几率使敌人灼烧，持续造成伤害',
  },
  // 流血
  {
    id: SKILL_AFFIX_IDS.DEBUFF_BLEED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'bleed',
      chance: { base: 0.75, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 80,
    tags: ['primary', 'debuff', 'dot'],
    displayName: '流血',
    displayDescription: '有几率使敌人流血，持续造成伤害',
  },
  // === 新增减益型主词条 ===
  // 腐蚀术
  {
    id: SKILL_AFFIX_IDS.DEBUFF_CORROSION,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'poison',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 50,
    minQuality: '地品',
    tags: ['primary', 'debuff', 'dot'],
    displayName: '腐蚀术',
    displayDescription: '中毒并降低防御',
  },
  // 破防
  {
    id: SKILL_AFFIX_IDS.DEBUFF_ARMOR_BREAK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'armor_down',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 3,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['primary', 'debuff'],
    displayName: '破防',
    displayDescription: '降低敌人防御',
  },
  // 压制
  {
    id: SKILL_AFFIX_IDS.DEBUFF_SUPPRESS,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 50,
    minQuality: '地品',
    tags: ['primary', 'debuff'],
    displayName: '压制',
    displayDescription: '降低敌人全属性',
  },
  // 破甲一击
  {
    id: SKILL_AFFIX_IDS.DEBUFF_ARMOR_SHRED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'armor_down',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 4,
    },
    weight: 45,
    minQuality: '地品',
    tags: ['primary', 'debuff'],
    displayName: '破甲一击',
    displayDescription: '大幅降低防御，持续多回合',
  },
  // 封脉术
  {
    id: SKILL_AFFIX_IDS.DEBUFF_SEAL_VEIN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 45,
    minQuality: '地品',
    tags: ['primary', 'debuff'],
    displayName: '封脉术',
    displayDescription: '降低灵力',
  },
  // 散功散
  {
    id: SKILL_AFFIX_IDS.DEBUFF_POWER_SCATTER,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.05 },
      durationOverride: 4,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['primary', 'debuff'],
    displayName: '散功散',
    displayDescription: '降低灵力，持续',
  },
  // 剧毒诅咒
  {
    id: SKILL_AFFIX_IDS.DEBUFF_POISON_WEAK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'poison',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 35,
    minQuality: '天品',
    tags: ['primary', 'debuff', 'dot'],
    displayName: '剧毒诅咒',
    displayDescription: '中毒并虚弱',
  },
  // 灼魂咒
  {
    id: SKILL_AFFIX_IDS.DEBUFF_BURN_REDUCTION,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'burn',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.05 },
      durationOverride: 2,
    },
    weight: 35,
    minQuality: '天品',
    tags: ['primary', 'debuff', 'dot'],
    displayName: '灼魂咒',
    displayDescription: '灼烧并降低治疗',
  },
  // 蚀骨散
  {
    id: SKILL_AFFIX_IDS.DEBUFF_BLEED_ARMOR,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'bleed',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 35,
    minQuality: '天品',
    tags: ['primary', 'debuff', 'dot'],
    displayName: '蚀骨散',
    displayDescription: '流血并降低防御',
  },
  // 封灵印
  {
    id: SKILL_AFFIX_IDS.DEBUFF_SEAL_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.08, scale: 'quality', coefficient: 0.75 },
      restoreToSelf: true,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'debuff'],
    displayName: '封灵印',
    displayDescription: '沉默并吸取法力',
  },
  // 虚弱光环
  {
    id: SKILL_AFFIX_IDS.DEBUFF_WEAKNESS_SLOW,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'debuff'],
    displayName: '虚弱光环',
    displayDescription: '虚弱并降低速度',
  },
];

const DEBUFF_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附带伤害
  {
    id: SKILL_AFFIX_IDS.DEBUFF_S_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.6, scale: 'root', coefficient: 0.3 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 60,
    tags: ['secondary', 'offensive'],
    displayName: '附带伤害',
    displayDescription: '减益技能附带伤害',
  },
  // === 新增减益型副词条 ===
  // 减益延长
  {
    id: SKILL_AFFIX_IDS.DEBUFF_S_EXTENDED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'INHERIT',
      durationOverride: 3,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'debuff'],
    displayName: '减益延长',
    displayDescription: '延长减益持续时间',
  },
  // 双重减益
  {
    id: SKILL_AFFIX_IDS.DEBUFF_S_DOUBLE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'weakness',
      durationOverride: 2,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['secondary', 'debuff'],
    displayName: '双重减益',
    displayDescription: '施加两个debuff',
  },
  // 减益强化
  {
    id: SKILL_AFFIX_IDS.DEBUFF_S_ENHANCED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'poison',
      durationOverride: 4,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'dot'],
    displayName: '减益强化',
    displayDescription: '增加DOT伤害',
  },
  // 破防减益
  {
    id: SKILL_AFFIX_IDS.DEBUFF_S_ARMOR_BREAK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'armor_down',
      durationOverride: 2,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'debuff'],
    displayName: '破防减益',
    displayDescription: '减益同时降低防御',
  },
];

// ============================================================
// 增益型技能词条
// ============================================================

const BUFF_AFFIXES: AffixWeight[] = [
  // 攻击增益
  {
    id: SKILL_AFFIX_IDS.BUFF_SPIRIT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'spirit_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 100,
    tags: ['primary', 'buff', 'offensive'],
    displayName: '灵力增幅',
    displayDescription: '提升自身灵力，持续3回合',
  },
  // 防御增益
  {
    id: SKILL_AFFIX_IDS.BUFF_VITALITY,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'vitality_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 100,
    tags: ['primary', 'buff', 'defensive'],
    displayName: '体魄增幅',
    displayDescription: '提升自身体魄，持续3回合',
  },
  // 速度增益
  {
    id: SKILL_AFFIX_IDS.BUFF_SPEED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'speed_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 80,
    tags: ['primary', 'buff', 'utility'],
    displayName: '速度增幅',
    displayDescription: '提升自身速度，持续3回合',
  },
  // 暴击增益
  {
    id: SKILL_AFFIX_IDS.BUFF_CRIT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'crit_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 60,
    minQuality: '真品',
    tags: ['primary', 'buff', 'offensive'],
    displayName: '暴击增幅',
    displayDescription: '提升自身暴击率，持续3回合',
  },
  // === 新增增益型主词条 ===
  // 护体术
  {
    id: SKILL_AFFIX_IDS.BUFF_ARMOR,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'armor_up',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 70,
    minQuality: '玄品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '护体术',
    displayDescription: '提升防御',
  },
  // 万法归一
  {
    id: SKILL_AFFIX_IDS.BUFF_ALL_STATS,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'all_stats_up',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['primary', 'buff'],
    displayName: '万法归一',
    displayDescription: '提升全属性',
  },
  // 狂暴
  {
    id: SKILL_AFFIX_IDS.BUFF_BERSERK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'berserk',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['primary', 'buff', 'burst'],
    displayName: '狂暴',
    displayDescription: '攻击提升防御降低',
  },
  // 铁壁
  {
    id: SKILL_AFFIX_IDS.BUFF_IRON_WALL,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'damage_reduction',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '铁壁',
    displayDescription: '减少受到的伤害',
  },
  // 迅影
  {
    id: SKILL_AFFIX_IDS.BUFF_SWIFT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'dodge_up',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['primary', 'buff', 'utility'],
    displayName: '迅影',
    displayDescription: '提升闪避率',
  },
  // 战意
  {
    id: SKILL_AFFIX_IDS.BUFF_WAR_INTENT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'spirit_boost',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['primary', 'buff', 'offensive'],
    displayName: '战意',
    displayDescription: '灵力和暴击提升',
  },
  // 龟息
  {
    id: SKILL_AFFIX_IDS.BUFF_TURTLE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'turtle_defense',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '龟息',
    displayDescription: '高减伤但无法攻击',
  },
  // 神佑
  {
    id: SKILL_AFFIX_IDS.BUFF_DIVINE,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 150, scale: 'root', coefficient: 6 },
      duration: 3,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '神佑',
    displayDescription: '大额护盾',
  },
  // 不灭金身
  {
    id: SKILL_AFFIX_IDS.BUFF_IMMORTAL,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'regeneration',
      durationOverride: 4,
      targetSelf: true,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '不灭金身',
    displayDescription: '减伤加持续回复',
  },
  // 绝境反击
  {
    id: SKILL_AFFIX_IDS.BUFF_DESPERATE,
    effectType: EffectType.Critical,
    trigger: EffectTrigger.ON_TURN_START,
    paramsTemplate: {
      critRateBonus: { base: 0.2, scale: 'quality', coefficient: 0.38 },
      critDamageBonus: { base: 0.3, scale: 'quality', coefficient: 0.38 },
    },
    weight: 25,
    minQuality: '天品',
    tags: ['primary', 'buff', 'burst'],
    displayName: '绝境反击',
    displayDescription: '低血量时大幅提升属性',
  },
  // 顿悟
  {
    id: SKILL_AFFIX_IDS.BUFF_ENLIGHTENMENT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'epiphany',
      durationOverride: 4,
      targetSelf: true,
    },
    weight: 20,
    minQuality: '神品',
    tags: ['primary', 'buff', 'burst'],
    displayName: '顿悟',
    displayDescription: '战斗内永久增益',
  },
  // 反击态势
  {
    id: SKILL_AFFIX_IDS.BUFF_COUNTER_STANCE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'counter_stance',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['primary', 'buff', 'counter'],
    displayName: '反击态势',
    displayDescription: '被攻击时反击',
  },
  // 元素护盾
  {
    id: SKILL_AFFIX_IDS.BUFF_ELEMENT_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 100, scale: 'root', coefficient: 4 },
      duration: 3,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '元素护盾',
    displayDescription: '特定元素护盾',
  },
  // 灵气护体
  {
    id: SKILL_AFFIX_IDS.BUFF_MANA_BODY,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'manaCost',
      modType: StatModifierType.PERCENT,
      value: -0.1,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['primary', 'buff', 'sustain'],
    displayName: '灵气护体',
    displayDescription: '减少法力消耗',
  },
  // 天神下凡
  {
    id: SKILL_AFFIX_IDS.BUFF_DIVINE_DESCENT,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'all_stats_up',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 20,
    minQuality: '神品',
    tags: ['primary', 'buff', 'burst'],
    displayName: '天神下凡',
    displayDescription: '全属性提升并减伤',
  },
  // 神速
  {
    id: SKILL_AFFIX_IDS.BUFF_GOD_SPEED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'speed_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['primary', 'buff', 'utility'],
    displayName: '神速',
    displayDescription: '速度和闪避提升',
  },
];

const BUFF_SECONDARY_AFFIXES: AffixWeight[] = [
  // 护盾
  {
    id: SKILL_AFFIX_IDS.BUFF_S_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 80, scale: 'root', coefficient: 3 },
      duration: 3,
    },
    weight: 70,
    tags: ['secondary', 'defensive'],
    displayName: '附加护盾',
    displayDescription: '增益技能额外获得护盾',
  },
  // 治疗
  {
    id: SKILL_AFFIX_IDS.BUFF_S_HEAL,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.2, scale: 'root', coefficient: 0.1 },
      targetSelf: true,
    },
    weight: 50,
    tags: ['secondary', 'healing'],
    displayName: '附加治疗',
    displayDescription: '增益技能额外恢复生命',
  },
  // 法力回复
  {
    id: SKILL_AFFIX_IDS.BUFF_S_MANA_REGEN,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.05, scale: 'quality', coefficient: 0.75 },
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '灵枢引力',
    displayDescription: '每回合恢复法力值',
  },
  // === 新增增益型副词条 ===
  // 增益延长
  {
    id: SKILL_AFFIX_IDS.BUFF_S_EXTENDED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'INHERIT',
      durationOverride: 4,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'buff'],
    displayName: '增益延长',
    displayDescription: '延长增益持续时间',
  },
  // 复合增益
  {
    id: SKILL_AFFIX_IDS.BUFF_S_DOUBLE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'spirit_boost',
      durationOverride: 2,
    },
    weight: 25,
    minQuality: '天品',
    tags: ['secondary', 'buff'],
    displayName: '复合增益',
    displayDescription: '施加两个buff',
  },
  // 紧急治疗
  {
    id: SKILL_AFFIX_IDS.BUFF_S_EMERGENCY,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_TURN_START,
    paramsTemplate: {
      multiplier: { base: 0.8, scale: 'root', coefficient: 0.4 },
      targetSelf: true,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'healing', 'burst'],
    displayName: '紧急治疗',
    displayDescription: '低血量时自动治疗',
  },
  // 法力回复
  {
    id: SKILL_AFFIX_IDS.BUFF_S_MANA,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      percentOfMax: { base: 0.08, scale: 'quality', coefficient: 0.75 },
    },
    weight: 30,
    minQuality: '真品',
    tags: ['secondary', 'sustain'],
    displayName: '法力回复',
    displayDescription: '使用技能时回复法力',
  },
  // 属性反弹
  {
    id: SKILL_AFFIX_IDS.BUFF_S_REFLECT,
    effectType: EffectType.ReflectDamage,
    trigger: EffectTrigger.ON_BEING_HIT,
    paramsTemplate: {
      reflectPercent: { base: 0.15, scale: 'quality', coefficient: 0.75 },
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '属性反弹',
    displayDescription: '反弹受到的伤害',
  },
  // 复苏
  {
    id: SKILL_AFFIX_IDS.BUFF_S_RECOVER,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      multiplier: { base: 0.2, scale: 'root', coefficient: 0.1 },
      targetSelf: true,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'healing'],
    displayName: '复苏',
    displayDescription: '受到治疗时额外回复',
  },
  // 自愈
  {
    id: SKILL_AFFIX_IDS.BUFF_S_SELF_HEAL,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.03, scale: 'quality', coefficient: 0.01 },
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'sustain'],
    displayName: '自愈',
    displayDescription: '回复法力和生命',
  },
];

// ============================================================
// 导出词条池（按技能类型）
// ============================================================

export const SKILL_AFFIX_POOLS: Record<
  SkillType,
  {
    primary: AffixWeight[];
    secondary: AffixWeight[];
  }
> = {
  attack: {
    primary: ATTACK_AFFIXES,
    secondary: ATTACK_SECONDARY_AFFIXES,
  },
  heal: {
    primary: HEAL_AFFIXES,
    secondary: HEAL_SECONDARY_AFFIXES,
  },
  control: {
    primary: CONTROL_AFFIXES,
    secondary: CONTROL_SECONDARY_AFFIXES,
  },
  debuff: {
    primary: DEBUFF_AFFIXES,
    secondary: DEBUFF_SECONDARY_AFFIXES,
  },
  buff: {
    primary: BUFF_AFFIXES,
    secondary: BUFF_SECONDARY_AFFIXES,
  },
};

/**
 * 根据技能类型获取词条池
 */
export function getSkillAffixPool(skillType: SkillType): {
  primary: AffixWeight[];
  secondary: AffixWeight[];
} {
  return SKILL_AFFIX_POOLS[skillType] || SKILL_AFFIX_POOLS.attack;
}
