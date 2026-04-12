/**
 * GameplayTags: creation-v2 与 battle-v5 共用的运行时语义词表。
 *
 * 约定：
 * 1. 所有运行时标签都从这里取值，不允许手写字符串。
 * 2. 叶子节点用于实际挂载与匹配，ROOT 仅用于表达父命名空间或做前缀判断。
 * 3. Ability 轴已显式拆成 Function / Channel / Kind / Element / Target，避免再把“做什么”和“走哪条伤害通道”混为一谈。
 */
export const GameplayTags = {
  // ===== 单位域 =====
  UNIT: {
    ROOT: 'Unit',
    TYPE: {
      ROOT: 'Unit.Type',
      PLAYER: 'Unit.Type.Player',
      ENEMY: 'Unit.Type.Enemy',
      COMBATANT: 'Unit.Type.Combatant',
    },
  },

  // ===== 状态域 =====
  // STATE 表示具体状态；CATEGORY 表示通用分类；CONTROL / IMMUNE 是具备父子层级的专门分支。
  STATUS: {
    ROOT: 'Status',
    IMMUNE: {
      ROOT: 'Status.Immune',
      CONTROL: 'Status.Immune.Control',
      DEBUFF: 'Status.Immune.Debuff',
      FIRE: 'Status.Immune.Fire',
    },
    STATE: {
      POISONED: 'Status.Poisoned',
      BURNED: 'Status.Burned',
      FROZEN: 'Status.Frozen',
      BLEEDING: 'Status.Bleeding',
      CHILLED: 'Status.Chilled',
    },
    CATEGORY: {
      BUFF: 'Status.Buff',
      DEBUFF: 'Status.Debuff',
      DOT: 'Status.DOT',
      DEF_DEBUFF: 'Status.DefDebuff',
      MYTHIC: 'Status.Mythic',
      COMBO: 'Status.Combo',
      MANA_EFF: 'Status.ManaEff',
    },
    CONTROL: {
      ROOT: 'Status.Control',
      STUNNED: 'Status.Control.Stunned',
      NO_ACTION: 'Status.Control.NoAction',
      NO_SKILL: 'Status.Control.NoSkill',
      NO_BASIC: 'Status.Control.NoBasic',
    },
  },

  // ===== 能力域 =====
  // Ability 是 battle-v5 最关键的运行时标签出口，必须按轴读取：
  // - FUNCTION：能力职责（damage/heal/control）
  // - CHANNEL：伤害通道（magic/physical/true）
  // - KIND：能力来源（skill/passive/artifact/gongfa）
  // - ELEMENT / TARGET：元素与目标范围
  ABILITY: {
    ROOT: 'Ability',
    FUNCTION: {
      ROOT: 'Ability.Function',
      DAMAGE: 'Ability.Function.Damage',
      CONTROL: 'Ability.Function.Control',
      HEAL: 'Ability.Function.Heal',
    },
    CHANNEL: {
      ROOT: 'Ability.Channel',
      MAGIC: 'Ability.Channel.Magic',
      PHYSICAL: 'Ability.Channel.Physical',
      TRUE: 'Ability.Channel.True',
    },
    KIND: {
      ROOT: 'Ability.Kind',
      SKILL: 'Ability.Kind.Skill',
      PASSIVE: 'Ability.Kind.Passive',
      ARTIFACT: 'Ability.Kind.Artifact',
      GONGFA: 'Ability.Kind.GongFa',
    },
    ELEMENT: {
      ROOT: 'Ability.Element',
      FIRE: 'Ability.Element.Fire',
      WATER: 'Ability.Element.Water',
      WOOD: 'Ability.Element.Wood',
      EARTH: 'Ability.Element.Earth',
      METAL: 'Ability.Element.Metal',
      WIND: 'Ability.Element.Wind',
      ICE: 'Ability.Element.Ice',
      THUNDER: 'Ability.Element.Thunder',
    },
    TARGET: {
      ROOT: 'Ability.Target',
      SINGLE: 'Ability.Target.Single',
      AOE: 'Ability.Target.AoE',
    },
  },

  // ===== Buff 域 =====
  BUFF: {
    ROOT: 'Buff',
    TYPE: {
      ROOT: 'Buff.Type',
      BUFF: 'Buff.Type.Buff',
      DEBUFF: 'Buff.Type.Debuff',
      CONTROL: 'Buff.Type.Control',
    },
    DOT: {
      ROOT: 'Buff.Dot',
      POISON: 'Buff.Dot.Poison',
      BURN: 'Buff.Dot.Burn',
      FREEZE: 'Buff.Dot.Freeze',
      BLEED: 'Buff.Dot.Bleed',
    },
    ELEMENT: {
      ROOT: 'Buff.Element',
      FIRE: 'Buff.Element.Fire',
      WATER: 'Buff.Element.Water',
      WOOD: 'Buff.Element.Wood',
      EARTH: 'Buff.Element.Earth',
      METAL: 'Buff.Element.Metal',
      WIND: 'Buff.Element.Wind',
      ICE: 'Buff.Element.Ice',
      THUNDER: 'Buff.Element.Thunder',
      POISON: 'Buff.Element.Poison',
    },
  },

  // ===== 战斗特性域 =====
  TRAIT: {
    ROOT: 'Trait',
    EXECUTE: 'Trait.Execute',
    REFLECT: 'Trait.Reflect',
    LIFESTEAL: 'Trait.Lifesteal',
    MANA_THIEF: 'Trait.ManaThief',
    SHIELD_MASTER: 'Trait.Shield',
    BERSERKER: 'Trait.Berserker',
    COOLDOWN: 'Trait.Cooldown',
  },

  // ===== 条件域 =====
  CONDITION: {
    ROOT: 'Condition',
    LOW_HP: 'Condition.LowHP',
    HIGH_HP: 'Condition.HighHP',
    CRIT_READY: 'Condition.CritReady',
    TARGET: {
      ROOT: 'Condition.Target',
      LOW_HP: 'Condition.Target.LowHP',
    },
    CASTER: {
      ROOT: 'Condition.Caster',
      LOW_HP: 'Condition.Caster.LowHP',
    },
  },

  // ===== 事件域：值需与 CombatEvent.type 对齐 =====
  EVENT: {
    ACTION_PRE: 'ActionPreEvent',
    DAMAGE_TAKEN: 'DamageTakenEvent',
    DAMAGE_REQUEST: 'DamageRequestEvent',
    DAMAGE: 'DamageEvent',
    ROUND_PRE: 'RoundPreEvent',
    SKILL_CAST: 'SkillCastEvent',
    BUFF_ADD: 'BuffAddEvent',
  },

  // ===== 监听器作用域 =====
  SCOPE: {
    OWNER_AS_TARGET: 'owner_as_target',
    OWNER_AS_ACTOR: 'owner_as_actor',
    OWNER_AS_CASTER: 'owner_as_caster',
    GLOBAL: 'global',
  },
} as const;

import type { ElementType } from '@/types/constants';

/**
 * 将 ElementType 中文字符映射到对应的运行时 Ability.Element.* 标签。
 * 供 AbilityTagAssembler 与 affix 条件构造使用。
 */
export const ELEMENT_TO_RUNTIME_ABILITY_TAG: Record<ElementType, string> = {
  金: GameplayTags.ABILITY.ELEMENT.METAL,
  木: GameplayTags.ABILITY.ELEMENT.WOOD,
  水: GameplayTags.ABILITY.ELEMENT.WATER,
  火: GameplayTags.ABILITY.ELEMENT.FIRE,
  土: GameplayTags.ABILITY.ELEMENT.EARTH,
  风: GameplayTags.ABILITY.ELEMENT.WIND,
  雷: GameplayTags.ABILITY.ELEMENT.THUNDER,
  冰: GameplayTags.ABILITY.ELEMENT.ICE,
};
