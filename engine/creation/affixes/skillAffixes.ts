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

import { EffectTrigger, EffectType } from '@/engine/effect/types';
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
  ATTACK_TRUE_DAMAGE: 'skill_attack_true_damage',
  ATTACK_DESTRUCTIVE: 'skill_attack_destructive',
  // 攻击型副词条（新增）
  ATTACK_ICE: 'skill_attack_ice',
  ATTACK_EXECUTE: 'skill_attack_execute',
  ATTACK_STORM: 'skill_attack_storm',
  ATTACK_LIFESTEAL: 'skill_attack_lifesteal',
  ATTACK_S_MANA_DRAIN: 'skill_attack_s_mana_drain',
  ATTACK_S_DOT_BURN: 'skill_attack_s_dot_burn',
  ATTACK_S_DOT_BLEED: 'skill_attack_s_dot_bleed',
  ATTACK_S_DOT_POISON: 'skill_attack_s_dot_poison',

  // 治疗型主词条
  HEAL_BASE: 'skill_heal_base',
  HEAL_STRONG: 'skill_heal_strong',
  HEAL_REGENERATION: 'skill_heal_regeneration',
  HEAL_PURIFY: 'skill_heal_purify',
  // 治疗型副词条
  HEAL_S_SHIELD: 'skill_heal_s_shield',
  HEAL_S_MANA_REGEN: 'skill_heal_s_mana_regen',

  // 控制型主词条
  CONTROL_STUN: 'skill_control_stun',
  CONTROL_FREEZE: 'skill_control_freeze',
  CONTROL_ROOT: 'skill_control_root',
  CONTROL_SILENCE: 'skill_control_silence',
  // 控制型副词条
  CONTROL_S_DAMAGE: 'skill_control_s_damage',
  CONTROL_S_MANA_DRAIN: 'skill_control_s_mana_drain',

  // 减益型主词条
  DEBUFF_WEAKNESS: 'skill_debuff_weakness',
  DEBUFF_POISON: 'skill_debuff_poison',
  DEBUFF_BURN: 'skill_debuff_burn',
  DEBUFF_BLEED: 'skill_debuff_bleed',
  DEBUFF_ARMOR_SHRED: 'skill_debuff_armor_shred',
  // 减益型副词条
  DEBUFF_S_DAMAGE: 'skill_debuff_s_damage',
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
  // BUFF_MANA_BODY removed - uses ON_CONSUME, not appropriate for active skills
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
    displayDescription: '造成基础伤害，可暴击',
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
    displayName: '高倍率伤害',
    displayDescription: '造成高倍率伤害，可暴击',
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
    displayDescription: '提高暴击率并造成伤害',
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
  // 真实伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_TRUE_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      baseDamage: { base: 1, scale: 'root', coefficient: 0.35 },
      ignoreShield: true,
      canCrit: false,
      ignoreReduction: true,
    },
    weight: 15,
    minQuality: '天品',
    tags: ['secondary', 'offensive', 'burst', 'true_damage'],
    displayName: '真实伤害',
    displayDescription: '造成无视护盾和减伤的真实伤害',
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
    displayDescription: '提高暴击伤害，并造成伤害',
  },
];

// 攻击型副词条
const ATTACK_SECONDARY_AFFIXES: AffixWeight[] = [
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
    displayName: '斩杀线伤害加成',
    displayDescription: '对低于30%生命值的敌人造成额外伤害',
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
    displayName: '附加伤害',
    displayDescription: '造成伤害后附加额外伤害',
  },
  // 吸血斩
  {
    id: SKILL_AFFIX_IDS.ATTACK_LIFESTEAL,
    effectType: EffectType.LifeSteal,
    trigger: EffectTrigger.ON_AFTER_DAMAGE,
    paramsTemplate: {
      stealPercent: { base: 0.1, scale: 'quality', coefficient: 0.75 },
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'lifesteal', 'sustain'],
    displayName: '生命偷取',
    displayDescription: '攻击时回复生命值',
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
  // DOT类型词条
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_DOT_BURN,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'burn',
      chance: { base: 0.3, scale: 'quality', coefficient: 0.05 },
      durationOverride: 2,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'debuff', 'dot'],
    displayName: '灼烧效果',
    displayDescription: '造成持续灼烧伤害',
  },
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_DOT_BLEED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'bleed',
      chance: { base: 0.3, scale: 'quality', coefficient: 0.05 },
      durationOverride: 2,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'debuff', 'dot'],
    displayName: '出血效果',
    displayDescription: '造成持续出血伤害',
  },
  {
    id: SKILL_AFFIX_IDS.ATTACK_S_DOT_POISON,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'poison',
      chance: { base: 0.3, scale: 'quality', coefficient: 0.05 },
      durationOverride: 2,
    },
    weight: 25,
    minQuality: '地品',
    tags: ['secondary', 'debuff', 'dot'],
    displayName: '中毒效果',
    displayDescription: '造成持续中毒伤害',
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
    displayDescription: '恢复自身生命值',
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
    displayDescription: '大量恢复自身生命值',
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
    displayName: '持续恢复',
    displayDescription: '获得持续回复状态',
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
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'shield',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'defensive'],
    displayName: '附加护盾',
    displayDescription: '治疗时额外获得护盾',
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
];

// ============================================================
// 减益型技能词条
// ============================================================

const DEBUFF_AFFIXES: AffixWeight[] = [
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
  {
    id: SKILL_AFFIX_IDS.DEBUFF_ARMOR_SHRED,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'armor_down',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 4,
    },
    weight: 50,
    tags: ['primary', 'debuff'],
    displayName: '破甲',
    displayDescription: '大幅降低防御，持续多回合',
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
    displayDescription: '大幅度提升暴击和暴击伤害',
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
  // 护盾
  {
    id: SKILL_AFFIX_IDS.BUFF_ELEMENT_SHIELD,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      buffId: 'shield',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '天品',
    tags: ['primary', 'buff', 'defensive'],
    displayName: '元素护盾',
    displayDescription: '特定元素护盾',
  },
];

const BUFF_SECONDARY_AFFIXES: AffixWeight[] = [
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
