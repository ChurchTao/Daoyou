/**
 * Buff 模板配置表
 *
 * 采用动态数值系统，支持：
 * - 基于施法者属性缩放
 * - 基于物品品质缩放
 * - 基于层数缩放
 */

import { BuffStackType, BuffTag, type BuffTemplate } from '@/engine/buff/types';
import {
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';

// ============================================================
// 战斗 Buff 模板
// ============================================================

/**
 * 增益 Buff 模板
 */
export const buffTemplates: BuffTemplate[] = [
  // ===== 增益 =====
  {
    id: 'shield',
    name: '护盾',
    icon: '🛡️',
    descriptionTemplate: '获得 {shield} 点护盾',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.Shield,
        paramsTemplate: {
          // 基础 50 + 施法者灵力 * 50%
          amount: { base: 50, scale: 'caster_spirit', coefficient: 0.5 },
        },
      },
    ],
  },
  {
    id: 'armor_up',
    name: '护体',
    icon: '💪',
    descriptionTemplate: '体魄提升 {percent}',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['armor_down'],
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          // 基础 10% + 品质加成
          value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.1, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
  {
    id: 'speed_up',
    name: '疾行',
    icon: '💨',
    descriptionTemplate: '速度提升 {value} 点',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'speed',
          modType: StatModifierType.FIXED,
          // 基础 15 + 品质加成
          value: { base: 15, scale: 'quality', coefficient: 5 },
        },
      },
    ],
  },
  {
    id: 'crit_rate_up',
    name: '锋锐',
    icon: '⚔️',
    descriptionTemplate: '暴击率提升 {percent}',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['crit_rate_down'],
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'critRate',
          modType: StatModifierType.PERCENT,
          // 基础 10% + 品质加成
          value: { base: 0.1, scale: 'quality', coefficient: 0.05 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.1, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
  {
    id: 'spirit_boost',
    name: '灵力激增',
    icon: '🔮',
    descriptionTemplate: '灵力提升 {percent}',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          // 基础 15% + 品质加成
          value: { base: 0.15, scale: 'quality', coefficient: 0.05 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.15, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
  {
    id: 'vitality_boost',
    name: '体魄强化',
    icon: '❤️‍🔥',
    descriptionTemplate: '体魄提升 {percent}',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          // 基础 15% + 品质加成
          value: { base: 0.15, scale: 'quality', coefficient: 0.05 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.15, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
  {
    id: 'crit_boost',
    name: '暴击增幅',
    icon: '💥',
    descriptionTemplate: '暴击率提升 {percent}，暴击伤害提升',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.Critical,
        paramsTemplate: {
          // 基础 15% + 品质加成
          critRateBonus: { base: 0.15, scale: 'quality', coefficient: 0.05 },
          critDamageBonus: { base: 0.3, scale: 'quality', coefficient: 0.1 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.15, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },

  // ===== 减益 =====
  {
    id: 'armor_down',
    name: '破防',
    icon: '💔',
    descriptionTemplate: '体魄降低 {percent}',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['armor_up'],
    tags: [BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          // 基础 -10% - 品质加成
          value: { base: -0.1, scale: 'quality', coefficient: -0.05 },
          // 【重要】用于占位符替换的百分比参数（取绝对值）
          percentValue: { base: 0.1, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
  {
    id: 'crit_rate_down',
    name: '暴击压制',
    icon: '📉',
    descriptionTemplate: '暴击率降低 {percent}',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    conflictsWith: ['crit_rate_up'],
    tags: [BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'critRate',
          modType: StatModifierType.PERCENT,
          // 基础 -10% - 品质加成
          value: { base: -0.1, scale: 'quality', coefficient: -0.05 },
          // 【重要】用于占位符替换的百分比参数（取绝对值）
          percentValue: { base: 0.1, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
  {
    id: 'slow',
    name: '迟缓',
    icon: '🐌',
    descriptionTemplate: '速度降低 {percent}',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'speed',
          modType: StatModifierType.PERCENT,
          // 基础 -25% - 品质加成
          value: { base: -0.25, scale: 'quality', coefficient: -0.05 },
          // 【重要】用于占位符替换的百分比参数（取绝对值）
          percentValue: { base: 0.25, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },

  // ===== 控制 =====
  {
    id: 'stun',
    name: '眩晕',
    icon: '💫',
    descriptionTemplate: '无法行动',
    maxStacks: 1,
    duration: 1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [],
  },
  {
    id: 'silence',
    name: '沉默',
    icon: '🤐',
    descriptionTemplate: '无法使用技能',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [],
  },
  {
    id: 'root',
    name: '定身',
    icon: '⛓️',
    descriptionTemplate: '无法闪避',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [],
  },
  {
    id: 'freeze',
    name: '冰冻',
    icon: '❄️',
    descriptionTemplate: '无法行动，防御提升 {percent}',
    maxStacks: 1,
    duration: 1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.CONTROL, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: 0.2, // 固定 20% 防御提升
          // 【重要】用于占位符替换的百分比参数
          percentValue: 0.2,
        },
      },
    ],
  },

  // ===== DOT =====
  {
    id: 'burn',
    name: '灼烧',
    icon: '🔥',
    descriptionTemplate: '每回合受到 {damage} 点火焰伤害',
    maxStacks: 3,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.DotDamage,
        paramsTemplate: {
          // 基础 20 + 施法者灵力 * 30%，层数会在战斗中额外乘算
          baseDamage: { base: 20, scale: 'caster_spirit', coefficient: 0.3 },
          element: '火',
          usesCasterStats: true,
        },
      },
    ],
  },
  {
    id: 'bleed',
    name: '流血',
    icon: '🩸',
    descriptionTemplate: '每回合受到 {damage} 点物理伤害',
    maxStacks: 3,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.DotDamage,
        paramsTemplate: {
          // 基础 25 + 施法者灵力 * 25%
          baseDamage: { base: 25, scale: 'caster_spirit', coefficient: 0.25 },
          element: '金',
          usesCasterStats: true,
        },
      },
    ],
  },
  {
    id: 'poison',
    name: '中毒',
    icon: '☠️',
    descriptionTemplate: '每回合受到 {damage} 点毒素伤害',
    maxStacks: 5,
    duration: 3,
    stackType: BuffStackType.STACK,
    tags: [BuffTag.DOT, BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.DotDamage,
        paramsTemplate: {
          // 基础 15 + 施法者灵力 * 20%，可叠加更多层
          baseDamage: { base: 15, scale: 'caster_spirit', coefficient: 0.2 },
          element: '木',
          usesCasterStats: true,
        },
      },
    ],
  },
];

// ============================================================
// 持久状态模板
// ============================================================

/**
 * 持久状态配置模板
 */
export const persistentBuffTemplates: BuffTemplate[] = [
  {
    id: 'weakness',
    name: '虚弱',
    icon: '🤒',
    descriptionTemplate: '全属性降低 {percent}',
    maxStacks: 1,
    duration: -1, // 永久
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: -0.1,
          // 【重要】用于占位符替换的百分比参数（取绝对值）
          percentValue: 0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'wisdom',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'speed',
          modType: StatModifierType.PERCENT,
          value: -0.1,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
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
    icon: '🩹',
    descriptionTemplate: '最大气血降低 10%',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
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
    icon: '🚑',
    descriptionTemplate: '最大气血大幅降低 30%',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
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
    icon: '💀',
    descriptionTemplate: '全属性与气血大幅降低 50%',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.DEBUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'wisdom',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'speed',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'willpower',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'maxHp',
          modType: StatModifierType.PERCENT,
          value: -0.5,
        },
      },
    ],
  },
];

// ============================================================
// 符箓 Buff 模板
// ============================================================

/**
 * 符箓消耗品对应的持久Buff模板
 */
export const talismanBuffTemplates: BuffTemplate[] = [
  {
    id: 'reshape_fate_talisman',
    name: '逆天改命',
    icon: '🌟',
    descriptionTemplate: '天机遮蔽，可逆转命数',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [],
  },
  {
    id: 'draw_gongfa_talisman',
    name: '神游太虚',
    icon: '📖',
    descriptionTemplate: '可感悟功法',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [],
  },
  {
    id: 'draw_skill_talisman',
    name: '法则加身',
    icon: '✨',
    descriptionTemplate: '可衍化神通',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [],
  },
];

// ============================================================
// 丹药 Buff 模板
// ============================================================

/**
 * 丹药消耗品对应的持久Buff模板
 * 用于闭关加成、突破加成等效果
 */
export const pillBuffTemplates: BuffTemplate[] = [
  {
    id: 'pill_enlightenment_state',
    name: '心明眼亮',
    icon: '💊',
    descriptionTemplate: '闭关修为获取效率 +{percent}',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.RetreatCultivationBonus,
        trigger: EffectTrigger.ON_RETREAT,
        paramsTemplate: {
          bonusPercent: 0.2, // +20% 修为收益
          // 【重要】用于占位符替换的百分比参数
          percentValue: 0.2,
        },
      },
    ],
  },
  {
    id: 'pill_insight_state',
    name: '灵感迸发',
    icon: '🧪',
    descriptionTemplate: '闭关感悟获取效率 +{percent}',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.RetreatComprehensionBonus,
        trigger: EffectTrigger.ON_RETREAT,
        paramsTemplate: {
          bonusPercent: 0.2, // +20% 感悟收益
          // 【重要】用于占位符替换的百分比参数
          percentValue: 0.2,
        },
      },
    ],
  },
  {
    id: 'breakthrough_luck',
    name: '机缘深厚',
    icon: '🍀',
    descriptionTemplate: '突破成功率 +{percent}',
    maxStacks: 1,
    duration: -1,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.PERSISTENT, BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.BreakthroughChanceBonus,
        trigger: EffectTrigger.ON_BREAKTHROUGH_CHECK,
        paramsTemplate: {
          bonusPercent: 0.15, // +15% 突破成功率
          maxBonus: 0.3, // 最多 30%
          // 【重要】用于占位符替换的百分比参数
          percentValue: 0.15,
        },
      },
    ],
  },
];

// ============================================================
// 新增动态 Buff 模板
// ============================================================

/**
 * 新增的高级 Buff 模板
 */
export const advancedBuffTemplates: BuffTemplate[] = [
  // 狂暴 - 攻击增加但防御降低
  {
    id: 'berserk',
    name: '狂暴',
    icon: '😤',
    descriptionTemplate: '灵力提升 {percent}，但防御降低',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          // 基础 25% + 品质加成
          value: { base: 0.25, scale: 'quality', coefficient: 0.05 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.25, scale: 'quality', coefficient: 0.05 },
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          // 基础 -15% - 品质加成
          value: { base: -0.15, scale: 'quality', coefficient: -0.05 },
        },
      },
    ],
  },

  // 龟息 - 极限防御但无法攻击
  {
    id: 'turtle_defense',
    name: '龟息',
    icon: '🛡️',
    descriptionTemplate: '减伤提升 {percent}，但无法攻击',
    maxStacks: 1,
    duration: 2,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.CONTROL], // 自我控制
    effectTemplates: [
      {
        type: EffectType.DamageReduction,
        paramsTemplate: {
          // 基础 40% + 品质加成
          percentReduction: { base: 0.4, scale: 'quality', coefficient: 0.1 },
          maxReduction: 0.75,
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.4, scale: 'quality', coefficient: 0.1 },
        },
      },
    ],
  },

  // 顿悟 - 战斗内永久增益
  {
    id: 'epiphany',
    name: '顿悟',
    icon: '💡',
    descriptionTemplate: '暴击率提升 {percent}，暴击伤害大幅提升',
    maxStacks: 1,
    duration: -1, // 战斗内永久
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.UNPURGEABLE],
    effectTemplates: [
      {
        type: EffectType.Critical,
        paramsTemplate: {
          // 基础 20% + 品质加成
          critRateBonus: { base: 0.2, scale: 'quality', coefficient: 0.05 },
          critDamageBonus: { base: 0.5, scale: 'quality', coefficient: 0.15 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.2, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },

  // 再生 - 持续治疗
  {
    id: 'regeneration',
    name: '再生',
    icon: '🌿',
    descriptionTemplate: '每回合恢复 {percent} 最大生命',
    maxStacks: 1,
    duration: 4,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.HOT, BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.Heal,
        trigger: EffectTrigger.ON_TURN_END,
        paramsTemplate: {
          multiplier: 0,
          // 基础 5% + 品质加成
          flatHeal: { base: 0.05, scale: 'quality', coefficient: 0.5 },
          targetSelf: true,
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.05, scale: 'quality', coefficient: 0.5 },
        },
      },
    ],
  },

  // 万法归一 - 全属性提升
  {
    id: 'all_stats_up',
    name: '万法归一',
    icon: '🌟',
    descriptionTemplate: '全属性提升 {percent}',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.PERCENT,
          value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'spirit',
          modType: StatModifierType.PERCENT,
          value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'wisdom',
          modType: StatModifierType.PERCENT,
          value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'speed',
          modType: StatModifierType.PERCENT,
          value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        },
      },
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'willpower',
          modType: StatModifierType.PERCENT,
          value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        },
      },
    ],
  },

  // 治疗削减
  {
    id: 'heal_reduction',
    name: '创伤',
    icon: '🩸',
    descriptionTemplate: '受到的治疗效果降低 {percent}',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.DEBUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.StatModifier,
        paramsTemplate: {
          stat: 'healReceived',
          modType: StatModifierType.PERCENT,
          // 基础 -40% - 品质加成
          value: { base: -0.4, scale: 'quality', coefficient: -0.1 },
          // 【重要】用于占位符替换的百分比参数（取绝对值）
          percentValue: { base: 0.4, scale: 'quality', coefficient: 0.1 },
        },
      },
    ],
  },

  // 反击态势 - 被攻击时反击
  {
    id: 'counter_stance',
    name: '反击态势',
    icon: '⚡',
    descriptionTemplate: '被攻击时有几率反击',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.CounterAttack,
        paramsTemplate: {
          // 基础 50% + 品质加成
          chance: { base: 0.5, scale: 'quality', coefficient: 0.1 },
          // 基础 40% + 品质加成
          damageMultiplier: { base: 0.4, scale: 'quality', coefficient: 0.1 },
          element: 'INHERIT',
        },
      },
    ],
  },

  // 减伤态势
  {
    id: 'damage_reduction',
    name: '铁壁',
    icon: '🏰',
    descriptionTemplate: '承受伤害降低 {percent}',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.DamageReduction,
        paramsTemplate: {
          // 基础 25% + 品质加成
          percentReduction: { base: 0.25, scale: 'quality', coefficient: 0.05 },
          maxReduction: 0.75,
          // 【重要】用于占位符替换的百分比参数
          percentValue: { base: 0.25, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },

  // 闪避提升
  {
    id: 'dodge_up',
    name: '迅影',
    icon: '💨',
    descriptionTemplate: '闪避率提升 {percent}',
    maxStacks: 1,
    duration: 3,
    stackType: BuffStackType.REFRESH,
    tags: [BuffTag.BUFF, BuffTag.PURGEABLE],
    effectTemplates: [
      {
        type: EffectType.ModifyHitRate,
        paramsTemplate: {
          // 基础 -30% 命中 + 品质加成
          hitRateModifier: { base: -0.3, scale: 'quality', coefficient: -0.05 },
          // 【重要】用于占位符替换的百分比参数（取绝对值）
          percentValue: { base: 0.3, scale: 'quality', coefficient: 0.05 },
        },
      },
    ],
  },
];

// ============================================================
// 导出所有模板
// ============================================================

export const allBuffTemplates: BuffTemplate[] = [
  ...buffTemplates,
  ...persistentBuffTemplates,
  ...talismanBuffTemplates,
  ...pillBuffTemplates,
  ...advancedBuffTemplates,
];
