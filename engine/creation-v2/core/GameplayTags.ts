/*
 * GameplayTags: 造物系统中的标签常量与容器实现。
 * - CreationTagContainer 提供层级标签查询（支持父标签匹配）
 * - CreationTags 为系统预定义标签集合（材料/意图/词缀/产物 等命名空间）
 */
import { CreationTagPath } from './types';

export class CreationTagContainer {
  private readonly tags = new Set<CreationTagPath>();

  addTags(tags: CreationTagPath[]): void {
    tags.forEach((tag) => this.tags.add(tag));
  }

  removeTags(tags: CreationTagPath[]): void {
    tags.forEach((tag) => this.tags.delete(tag));
  }

  hasTag(tag: CreationTagPath): boolean {
    if (!tag) {
      return false;
    }

    if (this.tags.has(tag)) {
      return true;
    }

    return this.getParentTags(tag).some((parentTag) => this.tags.has(parentTag));
  }

  hasAnyTag(tags: CreationTagPath[]): boolean {
    return tags.some((tag) => this.hasTag(tag));
  }

  hasAllTags(tags: CreationTagPath[]): boolean {
    return tags.every((tag) => this.hasTag(tag));
  }

  getTags(): CreationTagPath[] {
    return Array.from(this.tags);
  }

  clear(): void {
    this.tags.clear();
  }

  clone(): CreationTagContainer {
    const cloned = new CreationTagContainer();
    cloned.addTags(this.getTags());
    return cloned;
  }

  private getParentTags(tag: CreationTagPath): CreationTagPath[] {
    const parts = tag.split('.');
    const parents: CreationTagPath[] = [];

    for (let index = 1; index < parts.length; index++) {
      parents.push(parts.slice(0, index).join('.'));
    }

    return parents;
  }
}

export const CreationTags = {
  MATERIAL: {
    ROOT: 'Material',
    TYPE: 'Material.Type',
    TYPE_HERB: 'Material.Type.Herb',
    TYPE_ORE: 'Material.Type.Ore',
    TYPE_MONSTER: 'Material.Type.Monster',
    TYPE_MANUAL: 'Material.Type.Manual',
    TYPE_SPECIAL: 'Material.Type.Special',
    TYPE_AUXILIARY: 'Material.Type.Auxiliary',
    QUALITY: 'Material.Quality',
    ELEMENT: 'Material.Element',
    SEMANTIC: 'Material.Semantic',
    SEMANTIC_FLAME: 'Material.Semantic.Flame',
    SEMANTIC_FREEZE: 'Material.Semantic.Freeze',
    SEMANTIC_THUNDER: 'Material.Semantic.Thunder',
    SEMANTIC_WIND: 'Material.Semantic.Wind',
    SEMANTIC_BLADE: 'Material.Semantic.Blade',
    SEMANTIC_GUARD: 'Material.Semantic.Guard',
    SEMANTIC_BURST: 'Material.Semantic.Burst',
    SEMANTIC_SUSTAIN: 'Material.Semantic.Sustain',
    SEMANTIC_MANUAL: 'Material.Semantic.Manual',
    SEMANTIC_SPIRIT: 'Material.Semantic.Spirit',
    RECIPE: 'Material.Recipe',
  },
  INTENT: {
    ROOT: 'Intent',
    PRODUCT: 'Intent.Product',
    PRODUCT_SKILL: 'Intent.Product.Skill',
    PRODUCT_ARTIFACT: 'Intent.Product.Artifact',
    PRODUCT_GONGFA: 'Intent.Product.GongFa',
    OUTCOME: 'Intent.Outcome',
    OUTCOME_ACTIVE: 'Intent.Outcome.ActiveSkill',
    OUTCOME_PASSIVE: 'Intent.Outcome.PassiveAbility',
  },
  RECIPE: {
    ROOT: 'Recipe',
    PRODUCT_BIAS: 'Recipe.ProductBias',
    PRODUCT_BIAS_SKILL: 'Recipe.ProductBias.Skill',
    PRODUCT_BIAS_ARTIFACT: 'Recipe.ProductBias.Artifact',
    PRODUCT_BIAS_GONGFA: 'Recipe.ProductBias.GongFa',
    PRODUCT_BIAS_UTILITY: 'Recipe.ProductBias.Utility',
    INTENT: 'Recipe.Intent',
    INTENT_DEFENSIVE: 'Recipe.Intent.Defensive',
    MATCHED: 'Recipe.Matched',
    GATED: 'Recipe.Gated',
    UNLOCKED: 'Recipe.Unlocked',
  },
  ENERGY: {
    ROOT: 'Energy',
    BASE: 'Energy.Base',
    BONUS: 'Energy.Bonus',
    RESERVED: 'Energy.Reserved',
  },
  AFFIX: {
    ROOT: 'Affix',
    PREFIX: 'Affix.Prefix',
    SUFFIX: 'Affix.Suffix',
    CORE: 'Affix.Core',
    SIGNATURE: 'Affix.Signature',
  },
  OUTCOME: {
    ROOT: 'Outcome',
    ACTIVE_SKILL: 'Outcome.ActiveSkill',
    PASSIVE_ABILITY: 'Outcome.PassiveAbility',
    ARTIFACT: 'Outcome.Artifact',
    GONGFA: 'Outcome.GongFa',
  },
  /** Battle-side tags referenced by creation-v2 composition rules */
  BATTLE: {
    ABILITY_TYPE_DAMAGE: 'Ability.Type.Damage',
    ABILITY_TYPE_MAGIC: 'Ability.Type.Magic',
    ABILITY_TYPE_HEAL: 'Ability.Type.Heal',
    ABILITY_TYPE_CONTROL: 'Ability.Type.Control',
    ABILITY_KIND_ARTIFACT: 'Artifact',
    ABILITY_KIND_GONGFA: 'GongFa',
    BUFF_TYPE_CONTROL: 'Buff.Type.Control',
  },
  /** Battle event types used in passive listener specs.
   *
   * These string values mirror battle-v5 CombatEvent.type literals.
   * They are defined here (rather than imported directly from battle-v5 events)
   * to keep affix definitions isolated from battle-v5 implementation details.
   * If battle-v5 renames an event, update this map and recompile — TypeScript
   * will surface every usage site automatically.
   */
  BATTLE_EVENT: {
    ACTION_PRE: 'ActionPreEvent',
    DAMAGE_TAKEN: 'DamageTakenEvent',
    DAMAGE_REQUEST: 'DamageRequestEvent',
    DAMAGE: 'DamageEvent',
    ROUND_PRE: 'RoundPreEvent',
    SKILL_CAST: 'SkillCastEvent',
    BUFF_ADD: 'BuffAddEvent',
  },
  /** Listener scope values used in passive listener specs.
   *
   * Mirror of battle-v5 ListenerScope type values.
   */
  LISTENER_SCOPE: {
    OWNER_AS_TARGET: 'owner_as_target',
    OWNER_AS_ACTOR: 'owner_as_actor',
    OWNER_AS_CASTER: 'owner_as_caster',
    GLOBAL: 'global',
  },
} as const;