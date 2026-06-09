import type {
  AbilityConfig,
  AttributeModifierConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  projectAbilityConfig,
  type ArtifactProductModel,
  type GongFaProductModel,
  type SkillProductModel,
} from '@shared/engine/creation-v2/models';
import {
  composeProductFromAffixIds,
  type ComposeProductFromAffixIdsArgs,
} from '@shared/engine/creation-v2/composeProductFromAffixIds';
import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import type {
  Artifact,
  CultivationTechnique,
  Skill,
} from '@shared/types/cultivator';

type PresetProductType = 'skill' | 'gongfa' | 'artifact';

export interface PresetProductComposeArgs {
  productType: PresetProductType;
  element: ElementType;
  name: string;
  description?: string;
  affixIds: string[];
  requestedQuality?: Quality;
  requestedSlot?: EquipmentSlot;
  realm?: RealmType;
  realmStage?: RealmStage;
  creatorName?: string;
  creatorCultivatorId?: string;
}

export type PresetProductModel =
  | SkillProductModel
  | GongFaProductModel
  | ArtifactProductModel;

export type InitializedTechnique = CultivationTechnique & {
  abilityConfig: AbilityConfig;
  attributeModifiers: AttributeModifierConfig[];
  productModel: GongFaProductModel;
  quality: Quality;
};

export type InitializedSkill = Skill & {
  abilityConfig: AbilityConfig;
  productModel: SkillProductModel;
  quality: Quality;
};

export type InitializedArtifact = Artifact & {
  abilityConfig: AbilityConfig;
  attributeModifiers: AttributeModifierConfig[];
  productModel: ArtifactProductModel;
  quality: Quality;
};

export interface PresetTechniqueDefinition {
  name: string;
  element: ElementType;
  description?: string;
  affixIds: string[];
  quality?: Quality;
}

export interface PresetSkillDefinition {
  name: string;
  element: ElementType;
  description?: string;
  affixIds: string[];
  quality?: Quality;
}

export interface PresetArtifactDefinition {
  id?: string;
  name: string;
  slot: EquipmentSlot;
  element: ElementType;
  description?: string;
  affixIds: string[];
  quality?: Quality;
  realm?: RealmType;
  realmStage?: RealmStage;
  creatorName?: string;
  creatorCultivatorId?: string;
  score?: number;
  isEquipped?: boolean;
}

export function composePresetProductModel(
  args: PresetProductComposeArgs,
): PresetProductModel {
  return composeProductFromAffixIds(
    args as ComposeProductFromAffixIdsArgs,
  ) as PresetProductModel;
}

export function buildPresetTechnique(
  definition: PresetTechniqueDefinition,
): InitializedTechnique {
  const productModel = composePresetProductModel({
    productType: 'gongfa',
    element: definition.element,
    name: definition.name,
    description: definition.description,
    affixIds: definition.affixIds,
    requestedQuality: definition.quality,
  }) as GongFaProductModel;
  const abilityConfig = projectAbilityConfig(productModel);

  return {
    name: definition.name,
    element: definition.element,
    description: definition.description,
    quality: productModel.projectionQuality,
    attributeModifiers: abilityConfig.modifiers ?? [],
    abilityConfig,
    productModel,
  };
}

export function buildPresetSkill(
  definition: PresetSkillDefinition,
): InitializedSkill {
  const productModel = composePresetProductModel({
    productType: 'skill',
    element: definition.element,
    name: definition.name,
    description: definition.description,
    affixIds: definition.affixIds,
    requestedQuality: definition.quality,
  }) as SkillProductModel;
  const abilityConfig = projectAbilityConfig(productModel);

  return {
    name: definition.name,
    element: definition.element,
    description: definition.description,
    quality: productModel.projectionQuality,
    cost: abilityConfig.mpCost ?? 0,
    cooldown: abilityConfig.cooldown ?? 0,
    target_self:
      abilityConfig.targetPolicy?.team === 'self'
        ? true
        : abilityConfig.targetPolicy?.team === 'enemy'
          ? false
          : undefined,
    abilityConfig,
    productModel,
  };
}

export function buildPresetArtifact(
  definition: PresetArtifactDefinition,
): InitializedArtifact {
  const productModel = composePresetProductModel({
    productType: 'artifact',
    element: definition.element,
    name: definition.name,
    description: definition.description,
    affixIds: definition.affixIds,
    requestedSlot: definition.slot,
    requestedQuality: definition.quality,
    realm: definition.realm,
    realmStage: definition.realmStage,
    creatorName: definition.creatorName,
    creatorCultivatorId: definition.creatorCultivatorId,
  }) as ArtifactProductModel;
  const abilityConfig = projectAbilityConfig(productModel);

  return {
    id: definition.id,
    name: definition.name,
    slot: definition.slot,
    element: definition.element,
    description: definition.description,
    quality: productModel.projectionQuality,
    attributeModifiers: abilityConfig.modifiers ?? [],
    abilityConfig,
    productModel,
    score: definition.score,
    isEquipped: definition.isEquipped,
  };
}
