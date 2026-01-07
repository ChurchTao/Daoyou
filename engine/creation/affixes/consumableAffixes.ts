/**
 * 丹药词条池配置
 *
 * 丹药效果分为：
 * - 永久属性提升：服用后永久增加属性（通过特殊触发器实现）
 * - 临时增益：服用后获得临时 Buff
 * - 特殊效果：修为增加、寿元增加等
 */

import { EffectType, StatModifierType } from '@/engine/effect/types';
import type { AffixPool, AffixWeight } from '../types';

// ============================================================
// 主词条池 - 永久属性提升
// ============================================================

const PRIMARY_AFFIXES: AffixWeight[] = [
  // 永久体魄提升
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_CONSUME', // 特殊触发器：服用时触发，永久生效
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'realm', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'defensive'],
    displayName: '永久提升体魄',
  },
  // 永久灵力提升
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'realm', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '永久提升灵力',
  },
  // 永久悟性提升
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'realm', coefficient: 0.3 },
    },
    weight: 70,
    minQuality: '玄品',
    tags: ['primary', 'utility'],
    displayName: '永久提升悟性',
  },
  // 永久速度提升
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'realm', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'utility'],
    displayName: '永久提升速度',
  },
  // 永久神识提升
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'realm', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'defensive'],
    displayName: '永久提升神识',
  },
];

// ============================================================
// 副词条池 - 临时增益/特殊效果
// ============================================================

const SECONDARY_AFFIXES: AffixWeight[] = [
  // 临时攻击力增益
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'spirit_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'buff', 'offensive'],
    displayName: '临时灵力增幅',
  },
  // 临时防御增益
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'vitality_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'buff', 'defensive'],
    displayName: '临时体魄增幅',
  },
  // 恢复生命
  {
    effectType: EffectType.Heal,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      multiplier: { base: 0.2, scale: 'quality', coefficient: 0.1 },
      targetSelf: true,
    },
    weight: 60,
    tags: ['secondary', 'healing'],
    displayName: '恢复生命',
  },
  // 护盾
  {
    effectType: EffectType.Shield,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      amount: { base: 100, scale: 'realm', coefficient: 5 },
      duration: 3,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '获得护盾',
  },
  // 暴击率临时提升
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'crit_boost',
      durationOverride: 5,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'buff', 'offensive'],
    displayName: '暴击增幅',
  },

  // ============================================================
  // P0/P1 新增丹药效果
  // ============================================================

  // 回蓝丹
  {
    effectType: EffectType.ManaRegen,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      percentOfMax: { base: 0.4, scale: 'quality', coefficient: 0.15 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '恢复法力',
  },

  // 狂暴丹
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'berserk',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'buff', 'offensive', 'burst'],
    displayName: '狂暴增幅',
  },

  // 龟息丹
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'turtle_defense',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'buff', 'defensive'],
    displayName: '极限防御',
  },

  // 顿悟丹
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'epiphany',
      durationOverride: -1, // 战斗内永久
      targetSelf: true,
    },
    weight: 20,
    minQuality: '天品',
    tags: ['secondary', 'buff', 'burst'],
    displayName: '顿悟状态',
  },

  // 治疗增幅
  {
    effectType: EffectType.HealAmplify,
    trigger: 'ON_HEAL',
    paramsTemplate: {
      amplifyPercent: { base: 0.2, scale: 'quality', coefficient: 0.1 },
      affectOutgoing: false,
    },
    weight: 25,
    minQuality: '真品',
    tags: ['secondary', 'healing_boost'],
    displayName: '增强受疗',
  },
];

// ============================================================
// 诅咒词条池 - 负面效果（低品质或炼制失败）
// ============================================================

const CURSE_AFFIXES: AffixWeight[] = [
  // 药性剧烈，损耗寿元（概念性，需要特殊处理）
  {
    effectType: EffectType.StatModifier,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: -2,
    },
    weight: 50,
    maxQuality: '灵品',
    tags: ['curse'],
    displayName: '药性剧烈',
  },
  // 药毒残留
  {
    effectType: EffectType.AddBuff,
    trigger: 'ON_CONSUME',
    paramsTemplate: {
      buffId: 'poison',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 30,
    maxQuality: '凡品',
    tags: ['curse', 'dot'],
    displayName: '药毒残留',
  },
];

// ============================================================
// 导出词条池
// ============================================================

export const CONSUMABLE_AFFIX_POOL: AffixPool = {
  primary: PRIMARY_AFFIXES,
  secondary: SECONDARY_AFFIXES,
  curse: CURSE_AFFIXES,
};

/**
 * 根据方向标签获取推荐的丹药效果类型
 */
export function getRecommendedConsumableAffix(
  directionTag: string,
): string | undefined {
  const tagToStat: Record<string, string> = {
    increase_vitality: 'vitality',
    increase_spirit: 'spirit',
    increase_wisdom: 'wisdom',
    increase_speed: 'speed',
    increase_willpower: 'willpower',
    healing_boost: 'heal',
    cultivation_boost: 'cultivation_exp',
    lifespan_boost: 'lifespan',
  };
  return tagToStat[directionTag];
}
