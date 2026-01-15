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

import { EffectType } from '@/engine/effect/types';
import type { SkillType } from '@/types/constants';
import type { AffixWeight } from '../types';

// ============================================================
// 词条ID常量
// ============================================================

export const SKILL_AFFIX_IDS = {
  // 攻击型词条
  ATTACK_BASE_DAMAGE: 'skill_attack_base_damage',
  ATTACK_HEAVY_DAMAGE: 'skill_attack_heavy_damage',
  ATTACK_CRIT_DAMAGE: 'skill_attack_crit_damage',
  ATTACK_ARMOR_PIERCE: 'skill_attack_armor_pierce',
  ATTACK_EXECUTE: 'skill_attack_execute',
  ATTACK_TRUE_DAMAGE: 'skill_attack_true_damage',
  // 治疗型主词条
  HEAL_BASE: 'skill_heal_base',
  HEAL_STRONG: 'skill_heal_strong',
  HEAL_WITH_SHIELD: 'skill_heal_with_shield',
  // 治疗型副词条
  HEAL_S_SHIELD: 'skill_heal_s_shield',
  HEAL_S_HOT: 'skill_heal_s_hot',
  HEAL_S_DISPEL: 'skill_heal_s_dispel',
  HEAL_S_AMPLIFY: 'skill_heal_s_amplify',
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
  // 减益型副词条
  DEBUFF_S_DAMAGE: 'skill_debuff_s_damage',
  // 增益型主词条
  BUFF_SPIRIT: 'skill_buff_spirit',
  BUFF_VITALITY: 'skill_buff_vitality',
  BUFF_SPEED: 'skill_buff_speed',
  BUFF_CRIT: 'skill_buff_crit',
  // 增益型副词条
  BUFF_S_SHIELD: 'skill_buff_s_shield',
  BUFF_S_HEAL: 'skill_buff_s_heal',
  BUFF_S_MANA_REGEN: 'skill_buff_s_mana_regen',
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
      multiplier: { base: 1.0, scale: 'wisdom', coefficient: 0.5 },
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
      multiplier: { base: 1.5, scale: 'wisdom', coefficient: 0.8 },
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
      multiplier: { base: 1.2, scale: 'wisdom', coefficient: 0.6 },
      element: 'INHERIT',
      canCrit: true,
      critRateBonus: { base: 0.15, scale: 'quality', coefficient: 0.05 },
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
      multiplier: { base: 0.8, scale: 'wisdom', coefficient: 0.4 },
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
  // P1: 斩杀伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_EXECUTE,
    effectType: EffectType.ExecuteDamage,
    trigger: EffectTrigger.ON_BEFORE_DAMAGE,
    paramsTemplate: {
      thresholdPercent: 0.3,
      bonusDamage: { base: 0.2, scale: 'wisdom', coefficient: 0.1 },
    },
    weight: 20,
    minQuality: '地品',
    tags: ['secondary', 'offensive', 'burst', 'execute'],
    displayName: '斩杀',
    displayDescription: '对低于30%生命值的敌人造成额外伤害',
  },
  // P1: 真实伤害
  {
    id: SKILL_AFFIX_IDS.ATTACK_TRUE_DAMAGE,
    effectType: EffectType.TrueDamage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      baseDamage: { base: 50, scale: 'wisdom', coefficient: 15 },
      ignoreShield: true,
      ignoreReduction: true,
    },
    weight: 15,
    minQuality: '天品',
    tags: ['secondary', 'offensive', 'burst', 'true_damage'],
    displayName: '诛仙剑气',
    displayDescription: '造成无视护盾和减伤的真实伤害',
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
      multiplier: { base: 0.5, scale: 'wisdom', coefficient: 0.3 },
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
      multiplier: { base: 0.8, scale: 'wisdom', coefficient: 0.5 },
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
      multiplier: { base: 0.4, scale: 'wisdom', coefficient: 0.2 },
      targetSelf: true,
    },
    weight: 40,
    minQuality: '玄品',
    tags: ['primary', 'healing'],
    displayName: '治疗护体',
    displayDescription: '恢复生命值并附带防护效果',
  },
];

const HEAL_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附加护盾
  {
    id: SKILL_AFFIX_IDS.HEAL_S_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 50, scale: 'wisdom', coefficient: 2 },
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
  // P0: 驱散负面状态
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
  // P0: 治疗增幅
  {
    id: SKILL_AFFIX_IDS.HEAL_S_AMPLIFY,
    effectType: EffectType.HealAmplify,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      amplifyPercent: { base: 0.15, scale: 'wisdom', coefficient: 0.05 },
      affectOutgoing: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'healing_boost'],
    displayName: '木灵护体',
    displayDescription: '增强治疗效果',
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
      multiplier: { base: 0.4, scale: 'wisdom', coefficient: 0.2 },
      element: 'INHERIT',
      canCrit: false,
    },
    weight: 50,
    tags: ['secondary', 'offensive'],
    displayName: '附带伤害',
    displayDescription: '控制技能附带少量伤害',
  },
  // P0: 法力吸取
  {
    id: SKILL_AFFIX_IDS.CONTROL_S_MANA_DRAIN,
    effectType: EffectType.ManaDrain,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      drainPercent: { base: 0.1, scale: 'quality', coefficient: 0.05 },
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
];

const DEBUFF_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附带伤害
  {
    id: SKILL_AFFIX_IDS.DEBUFF_S_DAMAGE,
    effectType: EffectType.Damage,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      multiplier: { base: 0.6, scale: 'wisdom', coefficient: 0.3 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 60,
    tags: ['secondary', 'offensive'],
    displayName: '附带伤害',
    displayDescription: '减益技能附带伤害',
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
];

const BUFF_SECONDARY_AFFIXES: AffixWeight[] = [
  // 护盾
  {
    id: SKILL_AFFIX_IDS.BUFF_S_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_SKILL_HIT,
    paramsTemplate: {
      amount: { base: 80, scale: 'wisdom', coefficient: 3 },
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
      multiplier: { base: 0.2, scale: 'wisdom', coefficient: 0.1 },
      targetSelf: true,
    },
    weight: 50,
    tags: ['secondary', 'healing'],
    displayName: '附加治疗',
    displayDescription: '增益技能额外恢复生命',
  },
  // P0: 法力回复
  {
    id: SKILL_AFFIX_IDS.BUFF_S_MANA_REGEN,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_TURN_END,
    paramsTemplate: {
      percentOfMax: { base: 0.05, scale: 'quality', coefficient: 0.02 },
    },
    weight: 35,
    minQuality: '真品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '灵枢引力',
    displayDescription: '每回合恢复法力值',
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
    secondary: [], // 攻击型技能通常不需要副词条
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
