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
// 攻击型技能词条
// ============================================================

const ATTACK_AFFIXES: AffixWeight[] = [
  // 基础伤害
  {
    effectType: EffectType.Damage,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 1.0, scale: 'wisdom', coefficient: 0.5 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '基础伤害',
  },
  // 高倍率伤害
  {
    effectType: EffectType.Damage,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 1.5, scale: 'wisdom', coefficient: 0.8 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 50,
    minQuality: '玄品',
    tags: ['primary', 'offensive'],
    displayName: '重伤害',
  },
  // 暴击加成伤害
  {
    effectType: EffectType.Damage,
    trigger: 'ON_SKILL_HIT',
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
  },
  // 无视防御伤害
  {
    effectType: EffectType.Damage,
    trigger: 'ON_SKILL_HIT',
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
  },
];

// ============================================================
// 治疗型技能词条
// ============================================================

const HEAL_AFFIXES: AffixWeight[] = [
  // 基础治疗
  {
    effectType: EffectType.Heal,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 0.5, scale: 'wisdom', coefficient: 0.3 },
      targetSelf: true,
    },
    weight: 100,
    tags: ['primary', 'healing'],
    displayName: '基础治疗',
  },
  // 高效治疗
  {
    effectType: EffectType.Heal,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 0.8, scale: 'wisdom', coefficient: 0.5 },
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['primary', 'healing'],
    displayName: '强效治疗',
  },
  // 治疗 + 护盾
  {
    effectType: EffectType.Heal,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 0.4, scale: 'wisdom', coefficient: 0.2 },
      targetSelf: true,
    },
    weight: 40,
    minQuality: '玄品',
    tags: ['primary', 'healing'],
    displayName: '治疗护体',
  },
];

const HEAL_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附加护盾
  {
    effectType: EffectType.Shield,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      amount: { base: 50, scale: 'wisdom', coefficient: 2 },
      duration: 2,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['secondary', 'defensive'],
    displayName: '附加护盾',
  },
  // 持续回复
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'regeneration',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 40,
    minQuality: '真品',
    tags: ['secondary', 'healing'],
    displayName: '持续回复',
  },
];

// ============================================================
// 控制型技能词条
// ============================================================

const CONTROL_AFFIXES: AffixWeight[] = [
  // 眩晕
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'stun',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.1 },
      durationOverride: 1,
    },
    weight: 100,
    tags: ['primary', 'control'],
    displayName: '眩晕',
  },
  // 冰冻
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'freeze',
      chance: { base: 0.5, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 80,
    tags: ['primary', 'control'],
    displayName: '冰冻',
  },
  // 定身
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'root',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 70,
    tags: ['primary', 'control'],
    displayName: '定身',
  },
  // 沉默
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'silence',
      chance: { base: 0.6, scale: 'quality', coefficient: 0.1 },
      durationOverride: 2,
    },
    weight: 60,
    tags: ['primary', 'control'],
    displayName: '沉默',
  },
];

const CONTROL_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附带伤害
  {
    effectType: EffectType.Damage,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 0.4, scale: 'wisdom', coefficient: 0.2 },
      element: 'INHERIT',
      canCrit: false,
    },
    weight: 50,
    tags: ['secondary', 'offensive'],
    displayName: '附带伤害',
  },
];

// ============================================================
// 减益型技能词条
// ============================================================

const DEBUFF_AFFIXES: AffixWeight[] = [
  // 虚弱
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'weakness',
      chance: { base: 0.7, scale: 'quality', coefficient: 0.1 },
      durationOverride: 3,
    },
    weight: 100,
    tags: ['primary', 'debuff'],
    displayName: '虚弱',
  },
  // 中毒
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'poison',
      chance: { base: 0.8, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 90,
    tags: ['primary', 'debuff', 'dot'],
    displayName: '中毒',
  },
  // 灼烧
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'burn',
      chance: { base: 0.8, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 90,
    tags: ['primary', 'debuff', 'dot'],
    displayName: '灼烧',
  },
  // 流血
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'bleed',
      chance: { base: 0.75, scale: 'quality', coefficient: 0.05 },
      durationOverride: 3,
    },
    weight: 80,
    tags: ['primary', 'debuff', 'dot'],
    displayName: '流血',
  },
];

const DEBUFF_SECONDARY_AFFIXES: AffixWeight[] = [
  // 附带伤害
  {
    effectType: EffectType.Damage,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 0.6, scale: 'wisdom', coefficient: 0.3 },
      element: 'INHERIT',
      canCrit: true,
    },
    weight: 60,
    tags: ['secondary', 'offensive'],
    displayName: '附带伤害',
  },
];

// ============================================================
// 增益型技能词条
// ============================================================

const BUFF_AFFIXES: AffixWeight[] = [
  // 攻击增益
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'spirit_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 100,
    tags: ['primary', 'buff', 'offensive'],
    displayName: '灵力增幅',
  },
  // 防御增益
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'vitality_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 100,
    tags: ['primary', 'buff', 'defensive'],
    displayName: '体魄增幅',
  },
  // 速度增益
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'speed_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 80,
    tags: ['primary', 'buff', 'utility'],
    displayName: '速度增幅',
  },
  // 暴击增益
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      buffId: 'crit_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 60,
    minQuality: '真品',
    tags: ['primary', 'buff', 'offensive'],
    displayName: '暴击增幅',
  },
];

const BUFF_SECONDARY_AFFIXES: AffixWeight[] = [
  // 护盾
  {
    effectType: EffectType.Shield,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      amount: { base: 80, scale: 'wisdom', coefficient: 3 },
      duration: 3,
    },
    weight: 70,
    tags: ['secondary', 'defensive'],
    displayName: '附加护盾',
  },
  // 治疗
  {
    effectType: EffectType.Heal,
    trigger: 'ON_SKILL_HIT',
    paramsTemplate: {
      multiplier: { base: 0.2, scale: 'wisdom', coefficient: 0.1 },
      targetSelf: true,
    },
    weight: 50,
    tags: ['secondary', 'healing'],
    displayName: '附加治疗',
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
