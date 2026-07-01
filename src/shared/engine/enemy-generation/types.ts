import type { TargetPolicyConfig } from '@shared/engine/battle-v5/abilities/TargetPolicy';
import type {
  CreationContextTagBias,
  CreationProductType,
} from '@shared/engine/creation-v2/types';
import type {
  ElementType,
  EnemyRace,
  EquipmentSlot,
  Quality,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  BodyCultivationState,
} from '@shared/types/condition';
import type {
  Artifact,
  Attributes,
  CultivationTechnique,
  Cultivator,
  Skill,
} from '@shared/types/cultivator';

export const ATTRIBUTE_KEYS = [
  'vitality',
  'spirit',
  'wisdom',
  'speed',
  'willpower',
] as const satisfies ReadonlyArray<keyof Attributes>;

export type AttributeWeights = Record<(typeof ATTRIBUTE_KEYS)[number], number>;

export type DifficultyBand = 'core' | 'variant' | 'advanced' | 'legendary';

export type EnemySkillRole = 'offense' | 'control' | 'guard' | 'sustain';
export type EnemyArtifactRole = 'weapon' | 'armor' | 'accessory';
export type EnemyProductRole = 'technique' | EnemySkillRole | EnemyArtifactRole;

export interface EnemyGenerationInput {
  realm: RealmType;
  realmStage: RealmStage;
  race: EnemyRace;
  difficulty?: number;
  variantSeed?: string;
  name?: string;
  title?: string;
  background?: string;
  description?: string;
  isBoss?: boolean;
}

export interface NormalizedEnemyGenerationInput {
  realm: RealmType;
  realmStage: RealmStage;
  race: EnemyRace;
  difficulty: number;
  variantSeed?: string;
  name?: string;
  title?: string;
  background?: string;
  description?: string;
  isBoss: boolean;
}

export interface EnemyGenerationBalanceSnapshot {
  baseCap: number;
  difficultyFactor: number;
  totalAttributeBudget: number;
  band: DifficultyBand;
  variantKey: string;
  primaryElement: ElementType;
  secondaryElement: ElementType;
  primaryPersonaId: string;
  accentPersonaId?: string;
  recoveryTierUsed: number;
  bodyCultivation: EnemyBodyCultivationSummary;
}

export interface EnemyCopyProductFacts {
  id: string;
  productType: CreationProductType;
  role: EnemyProductRole;
  fallbackName: string;
  fallbackDescription: string;
  quality: Quality;
  element?: ElementType;
  slot?: EquipmentSlot;
  narrativeTags: string[];
  abilityTags: string[];
  affixNames: string[];
}

export interface EnemyCopyFacts {
  race: EnemyRace;
  realm: RealmType;
  realmStage: RealmStage;
  difficulty: number;
  difficultyFactor: number;
  bodyCultivation: EnemyBodyCultivationSummary;
  primaryElement: ElementType;
  secondaryElement: ElementType;
  profileTags: string[];
  personaTags: string[];
  character: {
    fallbackName: string;
    fallbackTitle: string;
    fallbackBackground: string;
    fallbackDescription: string;
  };
  products: EnemyCopyProductFacts[];
}

export interface EnemyGenerationDraft {
  input: NormalizedEnemyGenerationInput;
  missingNarrative: {
    name: boolean;
    title: boolean;
    background: boolean;
    description: boolean;
  };
  balance: EnemyGenerationBalanceSnapshot;
  copyFacts: EnemyCopyFacts;
  cultivator: Cultivator;
}

export interface EnemyRaceProfile {
  attributeWeights: AttributeWeights;
  elementPool: ElementType[];
  narrativeTags: string[];
  slotPriority: EquipmentSlot[];
  techniqueTags: string[];
  skillTags: string[];
  artifactTags: string[];
}

export type BodyCultivationTrackLevels = Record<BodyCultivationTrackKey, number>;

export interface EnemyBodyCultivationSummary {
  realm: BodyCultivationRealm;
  totalLevel: number;
  focusTracks: BodyCultivationTrackKey[];
  trackLevels: BodyCultivationTrackLevels;
}

export interface EnemyBodyCultivationPlan {
  state: BodyCultivationState;
  summary: EnemyBodyCultivationSummary;
}

export interface EnemyDifficultyProfile {
  band: DifficultyBand;
  skillCount: number;
  artifactCount: number;
  allowHighTier: boolean;
}

export interface EnemyArchetypeDefinition {
  id: string;
  productType: CreationProductType;
  label: string;
  elementMode: 'primary' | 'secondary' | 'earth' | 'fixed';
  fixedElement?: ElementType;
  slot?: EquipmentSlot;
  dominantTags: string[];
  positiveTagBiases?: CreationContextTagBias[];
  negativeTagBiases?: CreationContextTagBias[];
  targetPolicy?: TargetPolicyConfig;
  fallbackSuffix: string;
  fallbackDescription: string;
  minBand?: DifficultyBand;
  maxAffixCount?: Partial<Record<DifficultyBand, number>>;
  energyBias?: number;
  unlockBias?: number;
}

export interface EnemyPersonaTechniquePlan {
  role: 'technique';
  archetypeIds: string[];
  narrativeTags: string[];
  tagOverlays?: string[];
}

export interface EnemyPersonaSkillPlan {
  role: EnemySkillRole;
  archetypeIds: string[];
  narrativeTags: string[];
  tagOverlays?: string[];
}

export interface EnemyPersonaArtifactPlan {
  role: EnemyArtifactRole;
  slot: EquipmentSlot;
  archetypeIds: string[];
  narrativeTags: string[];
  tagOverlays?: string[];
}

export interface EnemyPersonaDefinition {
  id: string;
  label: string;
  narrativeTags: string[];
  technique: EnemyPersonaTechniquePlan;
  skills: EnemyPersonaSkillPlan[];
  artifacts: Partial<Record<EquipmentSlot, EnemyPersonaArtifactPlan>>;
  accentSkillRole: EnemySkillRole;
  accentArtifactSlot: EquipmentSlot;
}

export interface EnemyPlannedProductIntent {
  stableId: string;
  stableOutputKey: string;
  slugSeed: string;
  productType: CreationProductType;
  role: EnemyProductRole;
  slot?: EquipmentSlot;
  primaryElement: ElementType;
  secondaryElement: ElementType;
  dominantTags: string[];
  personaTags: string[];
  candidateArchetypeIds: string[];
  energyBudget: number;
  unlockScore: number;
  maxAffixCount: number;
  qualityFloor: Quality;
}

export interface EnemyLoadoutPlan {
  variantKey: string;
  primaryElement: ElementType;
  secondaryElement: ElementType;
  difficultyProfile: EnemyDifficultyProfile;
  primaryPersona: EnemyPersonaDefinition;
  accentPersona?: EnemyPersonaDefinition;
  technique: EnemyPlannedProductIntent;
  skills: EnemyPlannedProductIntent[];
  artifacts: EnemyPlannedProductIntent[];
}

export interface EnemyCraftedProduct {
  item: CultivationTechnique | Skill | Artifact;
  facts: EnemyCopyProductFacts;
}

export interface EnemyCraftedLoadout {
  primaryElement: ElementType;
  secondaryElement: ElementType;
  difficultyProfile: EnemyDifficultyProfile;
  technique: EnemyCraftedProduct;
  skills: EnemyCraftedProduct[];
  artifacts: EnemyCraftedProduct[];
  recoveryTierUsed: number;
}
