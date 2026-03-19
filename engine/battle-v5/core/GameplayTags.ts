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
    STUNNED: 'Status.Stunned',
    POISONED: 'Status.Poisoned',
  },

  // ===== 技能标签 =====
  ABILITY: {
    TYPE: 'Ability.Type',
    TYPE_DAMAGE: 'Ability.Type.Damage',
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

    // 持续伤害
    DOT: 'Buff.Dot',
    // 中毒、烧伤、冻结、出血
    DOT_POISON: 'Buff.Dot.Poison',
    DOT_BURN: 'Buff.Dot.Burn',
    DOT_FREEZE: 'Buff.Dot.Freeze',
    DOT_BLEED: 'Buff.Dot.Bleed',
  },
} as const;
