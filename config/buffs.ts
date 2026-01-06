/**
 * Buff 配置表
 * 集中管理所有 Buff 配置
 */

import type { BuffConfig } from '@/engine/buff/types';
import { BuffStackType, BuffTag } from '@/engine/buff/types';
import { EffectType, StatModifierType } from '@/engine/effect/types';

// ============================================================
// 战斗 Buff
// ============================================================

/**
 * 增益 Buff
 */
export const buffConfigs: BuffConfig[] = [
  // ===== 增益 =====
  {
    id: 'shield',
    name: '护盾',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.Shield,
        params: { amount: 100 },
      },
    ],
  },
  {
    id: 'armor_up',
    name: '护体',
    description: '减伤提升15%',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['armor_down'],
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: 0.15,
        },
      },
    ],
  },
  {
    id: 'speed_up',
    name: '疾行',
    description: '速度提升20点',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: { stat: 'speed', modType: StatModifierType.FIXED, value: 20 },
      },
    ],
  },
  {
    id: 'crit_rate_up',
    name: '锋锐',
    description: '暴击率提升15%',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['crit_rate_down'],
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'crit_rate',
          modType: StatModifierType.FIXED,
          value: 0.15,
        },
      },
    ],
  },

  // ===== 减益 =====
  {
    id: 'armor_down',
    name: '破防',
    description: '减伤降低15%',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['armor_up'],
    tags: [BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: -0.15,
        },
      },
    ],
  },
  {
    id: 'crit_rate_down',
    name: '暴击压制',
    description: '暴击率降低15%',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['crit_rate_up'],
    tags: [BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'crit_rate',
          modType: StatModifierType.FIXED,
          value: -0.15,
        },
      },
    ],
  },

  // ===== 控制 =====
  {
    id: 'stun',
    name: '眩晕',
    description: '无法行动',
    maxStacks: 1,
    duration: 1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [],
  },
  {
    id: 'silence',
    name: '沉默',
    description: '无法使用技能',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [],
  },
  {
    id: 'root',
    name: '定身',
    description: '无法闪避',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [],
  },

  // ===== DOT =====
  {
    id: 'burn',
    name: '灼烧',
    description: '火元素持续伤害',
    maxStacks: 3,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.DotDamage,
        params: { baseDamage: 60, element: '火', usesCasterStats: true },
      },
    ],
  },
  {
    id: 'bleed',
    name: '流血',
    description: '物理持续伤害',
    maxStacks: 3,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.DotDamage,
        params: { baseDamage: 60, element: '金', usesCasterStats: true },
      },
    ],
  },
  {
    id: 'poison',
    name: '中毒',
    description: '毒素持续伤害',
    maxStacks: 5,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effects: [
      {
        type: EffectType.DotDamage,
        params: { baseDamage: 60, element: '木', usesCasterStats: true },
      },
    ],
  },
];

// ============================================================
// 持久状态
// ============================================================

/**
 * 持久状态配置
 */
export const persistentBuffConfigs: BuffConfig[] = [
  {
    id: 'weakness',
    name: '虚弱',
    description: '全属性降低10%',
    maxStacks: 1,
    duration: -1, // 永久
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'wisdom',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'speed',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'willpower',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
    ],
  },
  {
    id: 'minor_wound',
    name: '轻伤',
    description: '最大气血降低10%',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'maxHp',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
    ],
  },
  {
    id: 'major_wound',
    name: '重伤',
    description: '最大气血大幅降低30%',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'maxHp',
          modType: StatModifierType.PERCENT,
          value: -0.3,
        },
      },
    ],
  },
  {
    id: 'near_death',
    name: '濒死',
    description: '全属性与气血大幅降低50%',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'wisdom',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'speed',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'willpower',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'maxHp',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
    ],
  },
];

// ============================================================
// 导出所有配置
// ============================================================

export const allBuffConfigs: BuffConfig[] = [
  ...buffConfigs,
  ...persistentBuffConfigs,
];
