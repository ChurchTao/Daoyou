import type { CreationMaterialSemanticTag } from '@shared/engine/shared/tag-domain';
import type { PillFamily } from '@shared/types/consumable';
import type { ElementType, MaterialType, Quality, RealmType } from '@shared/types/constants';

export const SPIRIT_FIELD_STAGES = ['germination', 'nourishing', 'forming'] as const;
export type SpiritFieldStage = (typeof SPIRIT_FIELD_STAGES)[number];

export const SPIRIT_FIELD_CULTIVATION_METHODS = [
  'seasonal_nurture', 'qi_sprout', 'stone_soil', 'sun_wake', 'shade_dew',
  'ore_soil', 'aux_formation', 'rest_nurture', 'intrinsic_infusion',
  'qi_growth', 'herb_companion', 'monster_blood', 'pill_nourish',
  'tcdb_return', 'aux_gather', 'leaf_medicine', 'flower_fruit',
  'return_treasure', 'natural_form',
] as const;
export type SpiritFieldCultivationMethod = (typeof SPIRIT_FIELD_CULTIVATION_METHODS)[number];

/** 兼容领域事件的历史命名；现在每个阶段只接受一次固定培育选择。 */
export const SPIRIT_FIELD_CARE_ACTIONS = SPIRIT_FIELD_CULTIVATION_METHODS;
export type SpiritFieldCareAction = SpiritFieldCultivationMethod;

export type SpiritFieldResourceKind =
  | 'none' | 'qi' | 'spirit_stones' | 'mp'
  | Extract<MaterialType, 'herb' | 'ore' | 'monster' | 'tcdb' | 'aux'>
  | 'pill';

export interface SpiritFieldMethodDefinition {
  id: SpiritFieldCultivationMethod;
  stage: SpiritFieldStage;
  name: string;
  description: string;
  resourceKind: SpiritFieldResourceKind;
  baseCost: number;
  extraSpiritStoneCost?: number;
  durationMultiplier?: number;
}

export const SPIRIT_SEED_GROWTH_FORMS = ['herb', 'flower', 'vine', 'shrub', 'tree', 'fungus', 'aquatic', 'root'] as const;
export type SpiritSeedGrowthForm = (typeof SPIRIT_SEED_GROWTH_FORMS)[number];
export const SPIRIT_SEED_HARVEST_PARTS = ['leaf', 'flower', 'fruit', 'root', 'rhizome', 'whole', 'spore', 'seedpod'] as const;
export type SpiritSeedHarvestPart = (typeof SPIRIT_SEED_HARVEST_PARTS)[number];
export const SPIRIT_SEED_HABITAT_TAGS = ['mountain', 'valley', 'forest', 'cave', 'wetland', 'waterside', 'rocky', 'volcanic', 'cold', 'warm', 'shaded', 'sunny'] as const;
export type SpiritSeedHabitatTag = (typeof SPIRIT_SEED_HABITAT_TAGS)[number];
export const SPIRIT_SEED_GROWTH_TRAITS = ['slow-rooting', 'quick-sprouting', 'qi-sensitive', 'stone-loving', 'companion-loving', 'blood-fed', 'sun-seeking', 'dew-seeking'] as const;
export type SpiritSeedGrowthTrait = (typeof SPIRIT_SEED_GROWTH_TRAITS)[number];
export const SPIRIT_SEED_USE_TAGS = ['alchemy', 'healing', 'qi-restoration', 'spirit-nourishing', 'body-tempering', 'marrow-wash', 'longevity', 'breakthrough', 'detox', 'meridian', 'formation'] as const;
export type SpiritSeedUseTag = (typeof SPIRIT_SEED_USE_TAGS)[number];
export const SPIRIT_FIELD_OUTCOME_KINDS = ['herb', 'tcdb', 'spirit_fruit'] as const;
export type SpiritFieldOutcomeKind = (typeof SPIRIT_FIELD_OUTCOME_KINDS)[number];

export interface SpiritSeedSkeleton { rank: Quality; quantity: number; forcedElement?: ElementType; regionTags?: string[] }
export interface SpiritSeedRandomOptions { guaranteedRank?: Quality; specifiedElement?: ElementType; regionTags?: string[]; qualityChanceMap?: Record<Quality, number>; rankRange?: { min: Quality; max: Quality } }

/** LLM 生成的种子身份与隐藏习性；标签永不直接发送给前端。 */
export interface SpiritSeedIdentity {
  seedName: string;
  seedDescription: string;
  clueTexts: string[];
  element: ElementType;
  growthForm: SpiritSeedGrowthForm;
  harvestPart: SpiritSeedHarvestPart;
  preferredMethods: SpiritFieldCultivationMethod[];
  avoidedMethods: SpiritFieldCultivationMethod[];
  preferredHabitats: SpiritSeedHabitatTag[];
  avoidedHabitats: SpiritSeedHabitatTag[];
  growthTraits: SpiritSeedGrowthTrait[];
  useTags: SpiritSeedUseTag[];
  outcomeBiases: SpiritFieldOutcomeKind[];
  creationTags: CreationMaterialSemanticTag[];
}

export interface SpiritFieldPlantSnapshot extends SpiritSeedIdentity {
  id: string;
  quality: Quality;
  minRealm: RealmType;
  stageDurationMs: Record<SpiritFieldStage, number>;
  baseYieldMin: number;
  baseYieldMax: number;
}

export interface SpiritFieldSeedSpec { version: 1; fingerprint: string; plant: SpiritFieldPlantSnapshot }
export type SpiritFieldStageAffinity = 'excellent' | 'good' | 'neutral' | 'strained';
export interface SpiritFieldStageHistory { stage: SpiritFieldStage; method: SpiritFieldCultivationMethod; affinity: SpiritFieldStageAffinity; score: number; feedback: string; resourceName?: string; completedAt: string }
export interface SpiritFieldPlotState { index: number; plantId: string | null; plant: SpiritFieldPlantSnapshot | null; plantedAt: string | null; stageIndex: number; stageStartedAt: string | null; stageEndsAt: string | null; history: SpiritFieldStageHistory[] }
export type SpiritFieldPlotRuntimeStatus = 'empty' | 'awaiting_cultivation' | 'growing' | 'ready_to_harvest';
export interface SpiritFieldStageJudgment { affinity: SpiritFieldStageAffinity; feedback: string }
export interface SpiritFieldHarvestSettlement { outcomeKind: SpiritFieldOutcomeKind; quality: Quality; quantity: number; score: number; mutated: boolean; degraded: boolean; fruitFamily?: PillFamily }
