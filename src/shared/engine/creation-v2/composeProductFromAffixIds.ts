import { CreationSession } from './CreationSession';
import {
  DEFAULT_AFFIX_REGISTRY,
  flattenAffixMatcherTags,
} from './affixes';
import type { AffixDefinition } from './affixes/types';
import { ProductComposerRegistry } from './composers/ProductComposerRegistry';
import type {
  ArtifactProductModel,
  GongFaProductModel,
  SkillProductModel,
} from './models';
import type {
  CreationSkillProjectionContext,
  CreationProductType,
  RolledAffix,
} from './types';
import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import type { TargetPolicyConfig } from '@shared/engine/battle-v5/abilities/TargetPolicy';
import { CREATION_PROJECTION_QUALITY_TIERS } from './config/CreationBalance';

const PRESET_QUALITY = '凡品' as const;
const PRESET_EFFECTIVE_ENERGY = 17;
const DEFAULT_ARTIFACT_CREATOR_NAME = '天道幻影';
const DEFAULT_ARTIFACT_CREATOR_ID = 'enemy-generator';

const composerRegistry = new ProductComposerRegistry();

export interface ComposeProductFromAffixIdsArgs {
  productType: CreationProductType;
  element: ElementType;
  name: string;
  description?: string;
  affixIds: string[];
  requestedSlot?: EquipmentSlot;
  requestedTargetPolicy?: TargetPolicyConfig;
  requestedQuality?: Quality;
  realm?: RealmType;
  realmStage?: RealmStage;
  creatorName?: string;
  creatorCultivatorId?: string;
  sessionId?: string;
  slugSeed?: string;
  projectionContext?: CreationSkillProjectionContext;
}

export type ComposedProductModel =
  | SkillProductModel
  | GongFaProductModel
  | ArtifactProductModel;

function recipeKeyElement(input: string): string {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function toRolledAffix(def: AffixDefinition): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    description: def.displayDescription,
    slot: def.slot,
    rarity: def.rarity,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    grantedAbilityTags: def.grantedAbilityTags,
    weight: def.weight,
    energyCost: def.energyCost,
    exclusiveGroup: def.exclusiveGroup,
    applicableArtifactSlots: def.applicableArtifactSlots,
    targetPolicyConstraint: def.targetPolicyConstraint,
    selectionMeta: def.selectionMeta,
    globalUnique: def.globalUnique,
    effectTemplate: def.effectTemplate,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
  };
}

function buildSyntheticMaterial(args: ComposeProductFromAffixIdsArgs) {
  const rank = args.requestedQuality ?? PRESET_QUALITY;

  if (args.productType === 'skill') {
    return {
      name: args.name,
      type: 'skill_manual' as const,
      rank,
      quantity: 1,
      element: args.element,
    };
  }

  if (args.productType === 'gongfa') {
    return {
      name: args.name,
      type: 'gongfa_manual' as const,
      rank,
      quantity: 1,
      element: args.element,
    };
  }

  return {
    name: args.name,
    type: 'ore' as const,
    rank,
    quantity: 1,
    element: args.element,
  };
}

function resolvePresetEffectiveEnergy(quality?: Quality): number {
  if (!quality) return PRESET_EFFECTIVE_ENERGY;
  const index = CREATION_PROJECTION_QUALITY_TIERS.findIndex(
    (tier) => tier.quality === quality,
  );
  if (index <= 0) return PRESET_EFFECTIVE_ENERGY;
  return CREATION_PROJECTION_QUALITY_TIERS[index - 1].maxEnergy;
}

export function composeProductFromAffixIds(
  args: ComposeProductFromAffixIdsArgs,
): ComposedProductModel {
  const defs = args.affixIds.map((affixId) => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
    if (!def) {
      throw new Error(`Unknown preset affix: ${affixId}`);
    }
    return def;
  });

  const rolledAffixes = defs.map(toRolledAffix);
  const spentEnergy = defs.reduce((sum, def) => sum + def.energyCost, 0);
  const effectiveTotal = resolvePresetEffectiveEnergy(args.requestedQuality);
  const unlockedAffixRarities = Array.from(
    new Set(defs.map((def) => def.rarity)),
  );
  const slugSeed =
    args.slugSeed ??
    `preset-${args.productType}-${args.element}-${recipeKeyElement(
      `${args.element}:${args.name}:${args.requestedSlot ?? 'none'}`,
    )}`;

  const session = new CreationSession({
    sessionId: args.sessionId,
    slugSeed,
    productType: args.productType,
    materials: [buildSyntheticMaterial(args)],
    ...(args.requestedSlot ? { requestedSlot: args.requestedSlot } : {}),
    ...(args.requestedTargetPolicy
      ? { requestedTargetPolicy: args.requestedTargetPolicy }
      : {}),
    ...(args.realm ? { realm: args.realm } : {}),
    ...(args.realmStage ? { realmStage: args.realmStage } : {}),
    ...(args.creatorName ? { creatorName: args.creatorName } : {}),
    ...(args.creatorCultivatorId
      ? { cultivatorId: args.creatorCultivatorId }
      : {}),
  });

  session.state.intent = {
    productType: args.productType,
    dominantTags: [],
    elementBias: args.element,
    ...(args.productType === 'artifact' && args.requestedSlot
      ? {
          slotBias: args.requestedSlot,
          slotBiasSource: 'requested',
        }
      : {}),
    ...(args.requestedTargetPolicy
      ? { targetPolicyBias: args.requestedTargetPolicy }
      : {}),
  };
  session.state.recipeMatch = {
    recipeId: `preset-${args.productType}`,
    valid: true,
    matchedTags: [],
    unlockedAffixRarities,
  };
  session.state.energyBudget = {
    baseTotal: effectiveTotal,
    effectiveTotal,
    reserved: 0,
    spent: spentEnergy,
    remaining: Math.max(0, effectiveTotal - spentEnergy),
    initialRemaining: effectiveTotal,
    allocations: [],
    rejections: [],
    sources: [{ source: 'preset', amount: effectiveTotal }],
  };
  session.state.rolledAffixes = rolledAffixes;
  if (args.projectionContext) {
    session.state.intentCraftMeta = {
      ...session.state.intentCraftMeta,
      projectionContext: args.projectionContext,
    };
  }

  const blueprint = composerRegistry.compose(session);
  const productModel = {
    ...blueprint.productModel,
    name: args.name,
    description: args.description ?? blueprint.productModel.description,
    ...(blueprint.productModel.name !== args.name
      ? { originalName: blueprint.productModel.name }
      : {}),
  } as ComposedProductModel;

  if (
    productModel.productType === 'artifact' &&
    args.realm &&
    args.realmStage
  ) {
    productModel.metadata = {
      creatorName: args.creatorName ?? DEFAULT_ARTIFACT_CREATOR_NAME,
      creatorCultivatorId:
        args.creatorCultivatorId ?? DEFAULT_ARTIFACT_CREATOR_ID,
      anchorRealm: args.realm,
      anchorRealmStage: args.realmStage,
      craftedAt: new Date().toISOString(),
    };
  }

  return productModel;
}
