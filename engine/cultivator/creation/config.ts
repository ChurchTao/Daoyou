import { EffectType, StatModifierType } from '@/engine/effect/types';
import type { ElementType } from '@/types/constants';
import type { CultivationTechnique, Skill } from '@/types/cultivator';

// 基础五行功法配置 (提供基础属性加成)
export const BASIC_TECHNIQUES: Record<
  ElementType,
  (grade: '黄阶下品' | '黄阶中品' | '黄阶上品') => CultivationTechnique
> = {
  金: (grade) => ({
    name: '金锐功',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
    ],
  }),
  木: (grade) => ({
    name: '长春功',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'wisdom',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
    ],
  }),
  水: (grade) => ({
    name: '弄潮诀',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'wisdom',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
    ],
  }),
  火: (grade) => ({
    name: '烈焰功',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: 8,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.FIXED,
          value: 2,
        },
      },
    ],
  }),
  土: (grade) => ({
    name: '厚土功',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'vitality',
          modType: StatModifierType.FIXED,
          value: 8,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'willpower',
          modType: StatModifierType.FIXED,
          value: 2,
        },
      },
    ],
  }),
  风: (grade) => ({
    name: '御风诀',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'speed',
          modType: StatModifierType.FIXED,
          value: 8,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: 2,
        },
      },
    ],
  }),
  雷: (grade) => ({
    name: '奔雷诀',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: 6,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'speed',
          modType: StatModifierType.FIXED,
          value: 4,
        },
      },
    ],
  }),
  冰: (grade) => ({
    name: '凝冰诀',
    grade,
    required_realm: '炼气',
    effects: [
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'spirit',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
      {
        type: EffectType.StatModifier,
        params: {
          stat: 'willpower',
          modType: StatModifierType.FIXED,
          value: 5,
        },
      },
    ],
  }),
};

// 基础五行法术配置 (一攻一守/辅)
export const BASIC_SKILLS: Record<ElementType, Skill[]> = {
  金: [
    {
      name: '金锋术',
      element: '金',
      grade: '黄阶下品',
      cooldown: 1,
      cost: 5,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.2, element: '金' },
        },
      ],
    },
    {
      name: '铁皮术',
      element: '金',
      grade: '黄阶下品',
      cooldown: 3,
      cost: 5,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'armor_up',
            durationOverride: 3,
            targetSelf: true,
          },
        },
      ],
    },
  ],
  木: [
    {
      name: '缠绕术',
      element: '木',
      grade: '黄阶下品',
      cooldown: 3,
      cost: 5,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 0.5, element: '木' },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'root',
            durationOverride: 2,
            targetSelf: false,
          },
        },
      ],
    },
    {
      name: '回春术',
      element: '木',
      grade: '黄阶下品',
      cooldown: 4,
      cost: 8,
      target_self: true,
      effects: [
        {
          type: EffectType.Heal,
          params: { multiplier: 1.5, targetSelf: true },
        },
      ],
    },
  ],
  水: [
    {
      name: '冰锥术',
      element: '水',
      grade: '黄阶下品',
      cooldown: 1,
      cost: 5,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.0, element: '水' },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'slow',
            durationOverride: 2,
            targetSelf: false,
          },
        },
      ],
    },
    {
      name: '水罩术',
      element: '水',
      grade: '黄阶下品',
      cooldown: 4,
      cost: 6,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'shield',
            durationOverride: 3,
            targetSelf: true,
          },
        },
      ],
    },
  ],
  火: [
    {
      name: '火弹术',
      element: '火',
      grade: '黄阶下品',
      cooldown: 2,
      cost: 8,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.4, element: '火' },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'burn',
            durationOverride: 2,
            targetSelf: false,
          },
        },
      ],
    },
    {
      name: '护体火盾',
      element: '火',
      grade: '黄阶下品',
      cooldown: 4,
      cost: 6,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'shield',
            durationOverride: 3,
            targetSelf: true,
          },
        },
      ],
    },
  ],
  土: [
    {
      name: '土刺术',
      element: '土',
      grade: '黄阶下品',
      cooldown: 2,
      cost: 6,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.3, element: '土' },
        },
      ],
    },
    {
      name: '土甲术',
      element: '土',
      grade: '黄阶下品',
      cooldown: 4,
      cost: 6,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'damage_reduction',
            durationOverride: 3,
            targetSelf: true,
          },
        },
      ],
    },
  ],
  风: [
    {
      name: '风刃术',
      element: '风',
      grade: '黄阶下品',
      cooldown: 0,
      cost: 4,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.1, element: '风' },
        },
      ],
    },
    {
      name: '轻身术',
      element: '风',
      grade: '黄阶下品',
      cooldown: 3,
      cost: 5,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'speed_up',
            durationOverride: 3,
            targetSelf: true,
          },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'dodge_up',
            durationOverride: 3,
            targetSelf: true,
          },
        },
      ],
    },
  ],
  雷: [
    {
      name: '掌心雷',
      element: '雷',
      grade: '黄阶下品',
      cooldown: 3,
      cost: 10,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.5, element: '雷' },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'stun',
            durationOverride: 1,
            targetSelf: false,
            chance: 0.3,
          },
        },
      ],
    },
    {
      name: '雷闪术',
      element: '雷',
      grade: '黄阶下品',
      cooldown: 4,
      cost: 8,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'speed_up',
            durationOverride: 2,
            targetSelf: true,
          },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'crit_rate_up',
            durationOverride: 2,
            targetSelf: true,
          },
        },
      ],
    },
  ],
  冰: [
    {
      name: '冰刺',
      element: '冰',
      grade: '黄阶下品',
      cooldown: 1,
      cost: 6,
      target_self: false,
      effects: [
        {
          type: EffectType.Damage,
          params: { multiplier: 1.1, element: '冰' },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'slow',
            durationOverride: 2,
            targetSelf: false,
          },
        },
      ],
    },
    {
      name: '冰甲术',
      element: '冰',
      grade: '黄阶下品',
      cooldown: 4,
      cost: 6,
      target_self: true,
      effects: [
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'shield',
            durationOverride: 3,
            targetSelf: true,
          },
        },
        {
          type: EffectType.AddBuff,
          params: {
            buffId: 'freeze',
            durationOverride: 1,
            targetSelf: false,
            chance: 0.1,
          },
        },
      ],
    },
  ],
};
