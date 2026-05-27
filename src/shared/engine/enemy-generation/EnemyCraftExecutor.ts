import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { CreationOrchestrator } from '@shared/engine/creation-v2/CreationOrchestrator';
import { DEFAULT_AFFIX_REGISTRY } from '@shared/engine/creation-v2/affixes';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { ELEMENT_TO_MATERIAL_TAG, ELEMENT_NAME_PREFIX } from '@shared/engine/creation-v2/config/CreationMappings';
import { CreationTags } from '@shared/engine/shared/tag-domain';
import {
  buildArtifactFromProductModel,
  buildSkillFromProductModel,
  buildTechniqueFromProductModel,
} from '@shared/engine/cultivator/creation/intentProducts';
import type { ArtifactProductModel, GongFaProductModel, SkillProductModel } from '@shared/engine/creation-v2/models';
import type {
  CreationContextTagBias,
  IntentCraftInput,
} from '@shared/engine/creation-v2/types';
import type {
  ElementType,
} from '@shared/types/constants';
import type {
  Artifact,
  CultivationTechnique,
  Skill,
} from '@shared/types/cultivator';
import { CREATION_RESERVED_ENERGY } from '@shared/engine/creation-v2/config/CreationBalance';
import { getEnemyArchetype } from './EnemyArchetypeRegistry';
import {
  DEFAULT_ENEMY_INTENT_SAFETY_PROFILE,
  type EnemyIntentSafetyProfile,
} from './EnemyIntentSafetyProfile';
import type {
  EnemyArchetypeDefinition,
  EnemyCraftedLoadout,
  EnemyCraftedProduct,
  EnemyLoadoutPlan,
  EnemyPlannedProductIntent,
  NormalizedEnemyGenerationInput,
} from './types';

type RuntimeEnemyProduct = CultivationTechnique | Skill | Artifact;

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function mergeBiases(
  ...groups: Array<CreationContextTagBias[] | undefined>
): CreationContextTagBias[] | undefined {
  const merged = new Map<string, number>();
  for (const group of groups) {
    for (const bias of group ?? []) {
      merged.set(bias.tag, Math.max(bias.weight, merged.get(bias.tag) ?? 0));
    }
  }
  if (merged.size === 0) {
    return undefined;
  }
  return Array.from(merged.entries()).map(([tag, weight]) => ({ tag, weight }));
}

function isArtifact(item: RuntimeEnemyProduct): item is Artifact {
  return 'slot' in item;
}

function isSkill(item: RuntimeEnemyProduct): item is Skill {
  return 'cooldown' in item;
}

function sameTargetPolicy(
  actual: EnemyArchetypeDefinition['targetPolicy'],
  expected: IntentCraftInput['requestedTargetPolicy'],
): boolean {
  if (!expected) return true;
  if (!actual) return false;

  const leftFilters = actual.filters ?? [];
  const rightFilters = expected.filters ?? [];
  return (
    actual.team === expected.team &&
    actual.scope === expected.scope &&
    (actual.maxTargets ?? 1) === (expected.maxTargets ?? 1) &&
    leftFilters.length === rightFilters.length &&
    leftFilters.every(
      (filter: string, index: number) => filter === rightFilters[index],
    )
  );
}

function coreSemanticTagsForIntent(
  intent: EnemyPlannedProductIntent,
): string[] {
  switch (intent.productType) {
    case 'gongfa':
      return [CreationTags.MATERIAL.SEMANTIC_MANUAL];
    case 'artifact':
      switch (intent.slot) {
        case 'armor':
          return [CreationTags.MATERIAL.SEMANTIC_GUARD];
        case 'accessory':
          return [CreationTags.MATERIAL.SEMANTIC_QI];
        case 'weapon':
        default:
          return [CreationTags.MATERIAL.SEMANTIC_BLADE];
      }
    case 'skill':
      switch (intent.role) {
        case 'control':
          return [CreationTags.MATERIAL.SEMANTIC_SPIRIT];
        case 'guard':
          return [CreationTags.MATERIAL.SEMANTIC_GUARD];
        case 'sustain':
          return [CreationTags.MATERIAL.SEMANTIC_SUSTAIN];
        case 'offense':
        default:
          return [CreationTags.MATERIAL.SEMANTIC_BURST];
      }
  }
}

export class EnemyCraftExecutor {
  constructor(
    private readonly creationOrchestrator: Pick<
      CreationOrchestrator,
      'craftFromIntent'
    > = new CreationOrchestrator(),
    private readonly safetyProfile: EnemyIntentSafetyProfile =
      DEFAULT_ENEMY_INTENT_SAFETY_PROFILE,
  ) {}

  execute(args: {
    input: NormalizedEnemyGenerationInput;
    plan: EnemyLoadoutPlan;
  }): EnemyCraftedLoadout {
    let recoveryTierUsed = 0;

    const technique = this.executeIntent(
      args.input,
      args.plan.difficultyProfile.band,
      args.plan.technique,
    );
    recoveryTierUsed = Math.max(recoveryTierUsed, technique.recoveryTierUsed);

    const skills = args.plan.skills.map((intent) => {
      const crafted = this.executeIntent(
        args.input,
        args.plan.difficultyProfile.band,
        intent,
      );
      recoveryTierUsed = Math.max(recoveryTierUsed, crafted.recoveryTierUsed);
      return crafted.product;
    });

    const artifacts = args.plan.artifacts.map((intent) => {
      const crafted = this.executeIntent(
        args.input,
        args.plan.difficultyProfile.band,
        intent,
      );
      recoveryTierUsed = Math.max(recoveryTierUsed, crafted.recoveryTierUsed);
      return crafted.product;
    });

    return {
      primaryElement: args.plan.primaryElement,
      secondaryElement: args.plan.secondaryElement,
      difficultyProfile: args.plan.difficultyProfile,
      technique: technique.product,
      skills,
      artifacts,
      recoveryTierUsed,
    };
  }

  private executeIntent(
    input: NormalizedEnemyGenerationInput,
    band: EnemyLoadoutPlan['difficultyProfile']['band'],
    intent: EnemyPlannedProductIntent,
  ): {
    product: EnemyCraftedProduct;
    recoveryTierUsed: number;
  } {
    const candidateArchetypes = intent.candidateArchetypeIds.map(getEnemyArchetype);

    for (const archetype of candidateArchetypes.slice(0, 1)) {
      const crafted = this.tryCraftFromIntent(input, band, intent, archetype, 0);
      if (crafted) {
        return { product: crafted, recoveryTierUsed: 0 };
      }
    }

    for (const archetype of candidateArchetypes.slice(1)) {
      const crafted = this.tryCraftFromIntent(input, band, intent, archetype, 1);
      if (crafted) {
        return { product: crafted, recoveryTierUsed: 1 };
      }
    }

    for (const archetype of candidateArchetypes) {
      const crafted = this.tryCraftFromIntent(input, band, intent, archetype, 2);
      if (crafted) {
        return { product: crafted, recoveryTierUsed: 2 };
      }
    }

    const fallbackArchetype = candidateArchetypes[0];
    return {
      product: this.composeSafeFallback(input, intent, fallbackArchetype),
      recoveryTierUsed: 3,
    };
  }

  private tryCraftFromIntent(
    input: NormalizedEnemyGenerationInput,
    band: EnemyLoadoutPlan['difficultyProfile']['band'],
    intent: EnemyPlannedProductIntent,
    archetype: EnemyArchetypeDefinition,
    recoveryTier: 0 | 1 | 2,
  ): EnemyCraftedProduct | null {
    const elements = this.resolveTierElements(intent, archetype, recoveryTier);
    for (const element of elements) {
      try {
        const normalized = this.buildIntentInput(
          input,
          band,
          intent,
          archetype,
          element,
          recoveryTier,
        );
        const session = this.creationOrchestrator.craftFromIntent(normalized, {
          autoMaterialize: false,
          namingMode: 'skip',
        });
        const blueprint = session.state.blueprint;
        if (!blueprint) {
          continue;
        }
        const fallbackName = this.buildFallbackName(archetype, element);
        const product = this.materializeFromProductModel(
          blueprint.productModel,
          input,
          intent,
          element,
          fallbackName,
          archetype.fallbackDescription,
        );
        this.validateProduct(product.item, intent, archetype);
        return {
          item: product.item,
          facts: {
            id: intent.stableId,
            productType: intent.productType,
            role: intent.role,
            fallbackName,
            fallbackDescription: archetype.fallbackDescription,
            quality: product.item.quality ?? '凡品',
            ...(intent.productType !== 'gongfa' ? { element } : { element }),
            ...(isArtifact(product.item) ? { slot: product.item.slot } : {}),
            narrativeTags: uniqueStrings([
              ...intent.personaTags,
              archetype.label,
              archetype.fallbackSuffix,
            ]),
            abilityTags: product.item.abilityConfig?.tags ?? [],
            affixNames: session.state.rolledAffixes.map((affix) => affix.name),
          },
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  private buildIntentInput(
    input: NormalizedEnemyGenerationInput,
    band: EnemyLoadoutPlan['difficultyProfile']['band'],
    intent: EnemyPlannedProductIntent,
    archetype: EnemyArchetypeDefinition,
    element: ElementType,
    recoveryTier: 0 | 1 | 2,
  ): IntentCraftInput {
    const loosened = recoveryTier >= 2;
    const dominantTags = uniqueStrings([
      ...intent.dominantTags,
      ...archetype.dominantTags,
      ELEMENT_TO_MATERIAL_TAG[element],
      ...(loosened ? coreSemanticTagsForIntent(intent) : []),
    ]).filter(
      (tag) => !loosened || tag !== CreationTags.MATERIAL.TYPE_SPECIAL,
    );
    const positiveTagBiases = mergeBiases(
      archetype.positiveTagBiases,
      loosened
        ? coreSemanticTagsForIntent(intent).map((tag) => ({
            tag,
            weight: 1,
          }))
        : undefined,
    )?.filter(
      (bias) => !loosened || bias.tag !== CreationTags.MATERIAL.TYPE_SPECIAL,
    );

    return {
      productType: intent.productType,
      energyBudget: Math.max(
        CREATION_RESERVED_ENERGY[intent.productType] + 10,
        intent.energyBudget + (archetype.energyBias ?? 0),
      ),
      unlockScore: Math.max(0, intent.unlockScore + (archetype.unlockBias ?? 0)),
      dominantTags,
      ...(positiveTagBiases ? { positiveTagBiases } : {}),
      ...(loosened ? {} : archetype.negativeTagBiases
        ? { negativeTagBiases: archetype.negativeTagBiases }
        : {}),
      elementBias: element,
      ...(intent.slot ?? archetype.slot
        ? { requestedSlot: (intent.slot ?? archetype.slot)! }
        : {}),
      ...(archetype.targetPolicy
        ? { requestedTargetPolicy: archetype.targetPolicy }
        : {}),
      realm: input.realm,
      realmStage: input.realmStage,
      seed: `${intent.slugSeed}:tier:${recoveryTier}:archetype:${archetype.id}`,
      slugSeed: intent.slugSeed,
      stableOutputKey: intent.stableOutputKey,
      maxAffixCount:
        archetype.maxAffixCount?.[band] ?? intent.maxAffixCount,
      excludedAffixIds: [...this.safetyProfile.excludedAffixIds],
      userPrompt: archetype.label,
    };
  }

  private resolveTierElements(
    intent: EnemyPlannedProductIntent,
    archetype: EnemyArchetypeDefinition,
    recoveryTier: 0 | 1 | 2,
  ): ElementType[] {
    const primary = this.resolveArchetypeElement(
      archetype,
      intent.primaryElement,
      intent.secondaryElement,
    );
    if (recoveryTier < 2) {
      return [primary];
    }

    const alternate = this.resolveAlternateElement(
      archetype,
      intent.primaryElement,
      intent.secondaryElement,
    );
    return alternate && alternate !== primary ? [primary, alternate] : [primary];
  }

  private resolveArchetypeElement(
    archetype: EnemyArchetypeDefinition,
    primaryElement: ElementType,
    secondaryElement: ElementType,
  ): ElementType {
    switch (archetype.elementMode) {
      case 'fixed':
        return archetype.fixedElement ?? primaryElement;
      case 'earth':
        return '土';
      case 'secondary':
        return secondaryElement;
      case 'primary':
      default:
        return primaryElement;
    }
  }

  private resolveAlternateElement(
    archetype: EnemyArchetypeDefinition,
    primaryElement: ElementType,
    secondaryElement: ElementType,
  ): ElementType | undefined {
    switch (archetype.elementMode) {
      case 'primary':
        return secondaryElement;
      case 'secondary':
        return primaryElement;
      default:
        return undefined;
    }
  }

  private composeSafeFallback(
    input: NormalizedEnemyGenerationInput,
    intent: EnemyPlannedProductIntent,
    archetype: EnemyArchetypeDefinition,
  ): EnemyCraftedProduct {
    const element = this.resolveArchetypeElement(
      archetype,
      intent.primaryElement,
      intent.secondaryElement,
    );
    const fallbackName = this.buildFallbackName(archetype, element);
    const fallbackDescription = archetype.fallbackDescription;
    const affixIds = this.safetyProfile.getFallbackAffixIds({
      productType: intent.productType,
      role: intent.role,
      element,
      ...(intent.slot ? { slot: intent.slot } : {}),
    });
    const productModel = composeProductFromAffixIds({
      productType: intent.productType,
      element,
      name: fallbackName,
      description: fallbackDescription,
      affixIds,
      ...(intent.slot ? { requestedSlot: intent.slot } : {}),
      realm: input.realm,
      realmStage: input.realmStage,
      slugSeed: intent.slugSeed,
    });
    const product = this.materializeFromProductModel(
      productModel,
      input,
      intent,
      element,
      fallbackName,
      fallbackDescription,
    );
    this.validateProduct(product.item, intent, archetype);

    return {
      item: product.item,
      facts: {
        id: intent.stableId,
        productType: intent.productType,
        role: intent.role,
        fallbackName,
        fallbackDescription,
        quality: product.item.quality ?? '凡品',
        ...(intent.productType !== 'gongfa' ? { element } : { element }),
        ...(isArtifact(product.item) ? { slot: product.item.slot } : {}),
        narrativeTags: uniqueStrings([
          ...intent.personaTags,
          archetype.label,
          'safe-fallback',
        ]),
        abilityTags: product.item.abilityConfig?.tags ?? [],
        affixNames: affixIds.map(
          (affixId) => DEFAULT_AFFIX_REGISTRY.queryById(affixId)?.displayName ?? affixId,
        ),
      },
    };
  }

  private materializeFromProductModel(
    productModel: GongFaProductModel | SkillProductModel | ArtifactProductModel,
    input: NormalizedEnemyGenerationInput,
    intent: EnemyPlannedProductIntent,
    element: ElementType,
    fallbackName: string,
    fallbackDescription: string,
  ): {
    item: RuntimeEnemyProduct;
  } {
    switch (intent.productType) {
      case 'gongfa':
        return {
          item: buildTechniqueFromProductModel(productModel as GongFaProductModel, {
            id: intent.stableId,
            name: fallbackName,
            description: fallbackDescription,
          }),
        };
      case 'skill':
        return {
          item: buildSkillFromProductModel(productModel as SkillProductModel, {
            id: intent.stableId,
            element,
            name: fallbackName,
            description: fallbackDescription,
          }),
        };
      case 'artifact':
        return {
          item: buildArtifactFromProductModel(productModel as ArtifactProductModel, {
            id: intent.stableId,
            element,
            realm: input.realm,
            realmStage: input.realmStage,
            name: fallbackName,
            description: fallbackDescription,
          }),
        };
    }
  }

  private validateProduct(
    item: RuntimeEnemyProduct,
    intent: EnemyPlannedProductIntent,
    archetype: EnemyArchetypeDefinition,
  ): void {
    if (!item.abilityConfig) {
      throw new Error('Missing abilityConfig');
    }
    AbilityFactory.create(item.abilityConfig);

    if (intent.productType === 'skill') {
      if (!isSkill(item)) {
        throw new Error('Expected skill output');
      }
      if (!sameTargetPolicy(item.abilityConfig.targetPolicy, archetype.targetPolicy)) {
        throw new Error('Skill target policy mismatch');
      }
      return;
    }

    if (intent.productType === 'artifact') {
      if (!isArtifact(item)) {
        throw new Error('Expected artifact output');
      }
      const expectedSlot = intent.slot ?? archetype.slot;
      if (expectedSlot && item.slot !== expectedSlot) {
        throw new Error('Artifact slot mismatch');
      }
    }
  }

  private buildFallbackName(
    archetype: EnemyArchetypeDefinition,
    element: ElementType,
  ): string {
    return `${ELEMENT_NAME_PREFIX[element]}${archetype.fallbackSuffix}`;
  }
}
