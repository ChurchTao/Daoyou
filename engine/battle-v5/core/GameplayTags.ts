import { TagPath } from './types';

/**
 * 标签容器：管理单位/技能/BUFF 的所有标签
 *
 * 核心特性：
 * 1. 父标签匹配：有 "Status.Immune" 则匹配 "Status.Immune.Stun"
 * 2. 批量操作：支持一次性添加/移除多个标签
 * 3. 不可变性：返回新容器而非修改原容器
 */
export class GameplayTagContainer {
  private _tags = new Set<TagPath>();

  /**
   * 添加标签（支持批量）
   */
  public addTags(tags: TagPath[]): void {
    tags.forEach((tag) => this._tags.add(tag));
  }

  /**
   * 移除标签（支持批量）
   */
  public removeTags(tags: TagPath[]): void {
    tags.forEach((tag) => this._tags.delete(tag));
  }

  /**
   * 检查是否有指定标签
   * 支持父标签匹配：如检查 "Status.Immune.Stun"，有 "Status.Immune" 也会返回 true
   */
  public hasTag(tag: TagPath): boolean {
    // 精确匹配
    if (this._tags.has(tag)) return true;

    // 父标签匹配
    const parentTags = this._getParentTags(tag);
    return parentTags.some((parent) => this._tags.has(parent));
  }

  /**
   * 检查是否有任意一个标签
   */
  public hasAnyTag(tags: TagPath[]): boolean {
    return tags.some((tag) => this.hasTag(tag));
  }

  /**
   * 检查是否有所有标签
   */
  public hasAllTags(tags: TagPath[]): boolean {
    return tags.every((tag) => this.hasTag(tag));
  }

  /**
   * 获取所有标签
   */
  public getTags(): TagPath[] {
    return Array.from(this._tags);
  }

  /**
   * 清空所有标签
   */
  public clear(): void {
    this._tags.clear();
  }

  /**
   * 克隆标签容器
   */
  public clone(): GameplayTagContainer {
    const clone = new GameplayTagContainer();
    clone.addTags(this.getTags());
    return clone;
  }

  /**
   * 获取父标签路径
   * "Ability.Element.Fire" -> ["Ability", "Ability.Element"]
   */
  private _getParentTags(tag: TagPath): TagPath[] {
    const parts = tag.split('.');
    const parents: TagPath[] = [];

    for (let i = 1; i < parts.length; i++) {
      parents.push(parts.slice(0, i).join('.'));
    }

    return parents;
  }
}

export const GameplayTags = {
  // ===== 单位标签 =====
  UNIT: {
    TYPE: 'Unit.Type',
    PLAYER: 'Unit.Type.Player',
    ENEMY: 'Unit.Type.Enemy',
    COMBATANT: 'Unit.Type.Combatant',
  },

  // ===== 状态标签 =====
  STATUS: {
    IMMUNE: 'Status.Immune',
    IMMUNE_CONTROL: 'Status.Immune.Control',
    IMMUNE_DEBUFF: 'Status.Immune.Debuff',
    IMMUNE_FIRE: 'Status.Immune.Fire',

    POISONED: 'Status.Poisoned',
    BURNED: 'Status.Burned',
    FROZEN: 'Status.Frozen',
    BLEEDING: 'Status.Bleeding',
    CHILLED: 'Status.Chilled',

    // 通用状态分类（用于免疫检查）
    BUFF: 'Status.Buff',
    DEBUFF: 'Status.Debuff',
    DOT: 'Status.DOT',
    DEF_DEBUFF: 'Status.DefDebuff',
    MYTHIC: 'Status.Mythic',
    COMBO: 'Status.Combo',
    MANA_EFF: 'Status.ManaEff',

    // 控制三分法
    CONTROL: 'Status.Control',
    STUNNED: 'Status.Control.Stunned',
    NO_ACTION: 'Status.Control.NoAction',
    NO_SKILL: 'Status.Control.NoSkill',
    NO_BASIC: 'Status.Control.NoBasic',
  },

  // ===== 能力标签 =====
  ABILITY: {
    TYPE: 'Ability.Type',
    KIND: 'Ability.Kind',

    // 能力类型
    TYPE_DAMAGE: 'Ability.Type.Damage',
    TYPE_TRUE_DAMAGE: 'Ability.Type.Damage.True',
    TYPE_CONTROL: 'Ability.Type.Control',
    TYPE_HEAL: 'Ability.Type.Heal',
    TYPE_MAGIC: 'Ability.Type.Magic',
    TYPE_PHYSICAL: 'Ability.Type.Physical',

    // 能力种类（来源）
    KIND_SKILL: 'Ability.Kind.Skill',
    KIND_PASSIVE: 'Ability.Kind.Passive',
    KIND_ARTIFACT: 'Ability.Kind.Artifact',
    KIND_GONGFA: 'Ability.Kind.GongFa',

    // 元素属性
    ELEMENT: 'Ability.Element',
    ELEMENT_FIRE: 'Ability.Element.Fire',
    ELEMENT_WATER: 'Ability.Element.Water',
    ELEMENT_WOOD: 'Ability.Element.Wood',
    ELEMENT_EARTH: 'Ability.Element.Earth',
    ELEMENT_METAL: 'Ability.Element.Metal',
    ELEMENT_WIND: 'Ability.Element.Wind',
    ELEMENT_ICE: 'Ability.Element.Ice',
    ELEMENT_THUNDER: 'Ability.Element.Thunder',

    // 目标范围
    TARGET: 'Ability.Target',
    TARGET_SINGLE: 'Ability.Target.Single',
    TARGET_AOE: 'Ability.Target.AoE',
  },

  // ===== BUFF 标签 =====
  BUFF: {
    TYPE: 'Buff.Type',
    TYPE_BUFF: 'Buff.Type.Buff',
    TYPE_DEBUFF: 'Buff.Type.Debuff',
    TYPE_CONTROL: 'Buff.Type.Control',

    DOT: 'Buff.Dot',
    DOT_POISON: 'Buff.Dot.Poison',
    DOT_BURN: 'Buff.Dot.Burn',
    DOT_FREEZE: 'Buff.Dot.Freeze',
    DOT_BLEED: 'Buff.Dot.Bleed',

    ELEMENT: 'Buff.Element',
    ELEMENT_FIRE: 'Buff.Element.Fire',
    ELEMENT_WATER: 'Buff.Element.Water',
    ELEMENT_WOOD: 'Buff.Element.Wood',
    ELEMENT_EARTH: 'Buff.Element.Earth',
    ELEMENT_METAL: 'Buff.Element.Metal',
    ELEMENT_WIND: 'Buff.Element.Wind',
    ELEMENT_ICE: 'Buff.Element.Ice',
    ELEMENT_THUNDER: 'Buff.Element.Thunder',
    ELEMENT_POISON: 'Buff.Element.Poison',
  },

  // ===== 战斗特性标签 (Traits) =====
  TRAIT: {
    EXECUTE: 'Trait.Execute',        // 斩杀
    REFLECT: 'Trait.Reflect',        // 反伤
    LIFESTEAL: 'Trait.Lifesteal',    // 吸血
    MANA_THIEF: 'Trait.ManaThief',   // 吸蓝
    SHIELD_MASTER: 'Trait.Shield',   // 护盾专精
    BERSERKER: 'Trait.Berserker',    // 狂战
    COOLDOWN: 'Trait.Cooldown',      // 冷却掌控
  },

  // ===== 战斗触发场景 (Scenarios/Conditions) =====
  CONDITION: {
    LOW_HP: 'Condition.LowHP',
    HIGH_HP: 'Condition.HighHP',
    CRIT_READY: 'Condition.CritReady',
    TARGET_LOW_HP: 'Condition.Target.LowHP',
    CASTER_LOW_HP: 'Condition.Caster.LowHP',
  },

  // ===== 战斗事件类型 (Events) - 对齐 CombatEvent.type =====
  EVENT: {
    ACTION_PRE: 'ActionPreEvent',
    DAMAGE_TAKEN: 'DamageTakenEvent',
    DAMAGE_REQUEST: 'DamageRequestEvent',
    DAMAGE: 'DamageEvent',
    ROUND_PRE: 'RoundPreEvent',
    SKILL_CAST: 'SkillCastEvent',
    BUFF_ADD: 'BuffAddEvent',
  },

  // ===== 监听器作用域 (Scopes) =====
  SCOPE: {
    OWNER_AS_TARGET: 'owner_as_target',
    OWNER_AS_ACTOR: 'owner_as_actor',
    OWNER_AS_CASTER: 'owner_as_caster',
    GLOBAL: 'global',
  },
} as const;

