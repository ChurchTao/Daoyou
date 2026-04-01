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
} as const;