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

/**
 * 标签命名约定（建议使用常量避免拼写错误）
 */
export const GameplayTags = {
  // ===== 单位类型标签 =====
  UNIT: {
    // 单位类型
    TYPE: 'Unit.Type',
    // 玩家
    PLAYER: 'Unit.Type.Player',
    // 敌人
    ENEMY: 'Unit.Type.Enemy',
    // 战斗单位
    COMBATANT: 'Unit.Type.Combatant',
  },

  // ===== 状态标签 =====
  STATUS: {
    // 免疫系列
    IMMUNE: 'Status.Immune',
    IMMUNE_CONTROL: 'Status.Immune.Control',
    IMMUNE_DEBUFF: 'Status.Immune.Debuff',
    IMMUNE_FIRE: 'Status.Immune.Fire',

    // 负面状态
    STUNNED: 'Status.Stunned',   // 眩晕（向后兼容，语义等同 NO_ACTION）
    POISONED: 'Status.Poisoned',

    // ===== 控制三分法 =====
    // 禁行动：单位本回合完全跳过出手（如眩晕、冰封、石化）
    NO_ACTION: 'Status.Control.NoAction',
    // 禁技：单位本回合只能使用普通攻击，不可使用主动技能（如封咒、禁灵）
    NO_SKILL: 'Status.Control.NoSkill',
    // 禁普攻：单位本回合只能使用技能，不可普通攻击（如折翅、束手）
    NO_BASIC: 'Status.Control.NoBasic',
  },

  // ===== 技能标签 =====
  ABILITY: {
    // 技能类型
    TYPE: 'Ability.Type',
    // 技能类型：伤害、控制、治疗、魔法、物理
    TYPE_DAMAGE: 'Ability.Type.Damage',
    TYPE_TRUE_DAMAGE: 'Ability.Type.Damage.True',
    TYPE_CONTROL: 'Ability.Type.Control',
    TYPE_HEAL: 'Ability.Type.Heal',
    TYPE_MAGIC: 'Ability.Type.Magic',
    TYPE_PHYSICAL: 'Ability.Type.Physical',

    ELEMENT: 'Ability.Element',
    // 元素: 火水木土金风冰雷
    ELEMENT_FIRE: 'Ability.Element.Fire',
    ELEMENT_WATER: 'Ability.Element.Water',
    ELEMENT_WOOD: 'Ability.Element.Wood',
    ELEMENT_EARTH: 'Ability.Element.Earth',
    ELEMENT_METAL: 'Ability.Element.Metal',
    ELEMENT_WIND: 'Ability.Element.Wind',
    ELEMENT_ICE: 'Ability.Element.Ice',
    ELEMENT_THUNDER: 'Ability.Element.Thunder',

    // 技能目标
    TARGET: 'Ability.Target',
    TARGET_SINGLE: 'Ability.Target.Single',
    TARGET_AOE: 'Ability.Target.AoE',
  },

  // ===== BUFF 标签 =====
  BUFF: {
    // BUFF 类型
    TYPE: 'Buff.Type',
    // BUFF 类型：增益、减益、控制
    TYPE_BUFF: 'Buff.Type.Buff',
    TYPE_DEBUFF: 'Buff.Type.Debuff',
    TYPE_CONTROL: 'Buff.Type.Control',

    // 持续伤害
    DOT: 'Buff.Dot',
    // 中毒、烧伤、冻结、出血
    DOT_POISON: 'Buff.Dot.Poison',
    DOT_BURN: 'Buff.Dot.Burn',
    DOT_FREEZE: 'Buff.Dot.Freeze',
    DOT_BLEED: 'Buff.Dot.Bleed',

    // 元素标签（用于元素免疫和克制）
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
} as const;
