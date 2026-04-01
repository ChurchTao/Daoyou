import type { Ability, AbilityConfig } from './contracts/battle';
import { EquipmentSlot, ElementType, Quality, RealmType } from '@/types/constants';
import { Material } from '@/types/cultivator';
import { CreationPhase } from './core/types';
import type { CreationProductModel } from './models/types';

export type CreationProductType = 'skill' | 'artifact' | 'gongfa';
export type CreationOutcomeKind = 'active_skill' | 'artifact' | 'gongfa';
export type AffixCategory = 'prefix' | 'suffix' | 'core' | 'signature';

export const CREATION_PRODUCT_TYPES = ['skill', 'artifact', 'gongfa'] as const;

export function isCreationProductType(
  value: string,
): value is CreationProductType {
  return (CREATION_PRODUCT_TYPES as readonly string[]).includes(value);
}

export interface CreationSessionInput {
  sessionId?: string;
  cultivatorId?: string;
  realm?: RealmType;
  productType: CreationProductType;
  materials: Material[];
  userPrompt?: string;
  requestedTags?: string[];
  requestedElement?: ElementType;
  requestedSlot?: EquipmentSlot;
}

export interface MaterialFingerprint {
  materialId?: string;
  materialName: string;
  materialType: Material['type'];
  rank: Quality;
  quantity: number;
  explicitTags: string[];
  semanticTags: string[];
  recipeTags: string[];
  energyValue: number;
  rarityWeight: number;
  element?: ElementType;
  metadata?: MaterialFingerprintMetadata;
}

export interface MaterialFingerprintLLMMetadata {
  status: 'disabled' | 'success' | 'fallback';
  failureDisposition?: 'retryable' | 'non_retryable';
  confidence?: number;
  addedTags: string[];
  droppedTags: string[];
  reason?: string;
  batchInsight?: string;
  provider?: string;
}

export interface MaterialFingerprintMetadata extends Record<string, unknown> {
  description?: string;
  llm?: MaterialFingerprintLLMMetadata;
}

export interface CreationIntent {
  productType: CreationProductType;
  outcomeKind: CreationOutcomeKind;
  dominantTags: string[];
  requestedTags: string[];
  elementBias?: ElementType;
  slotBias?: EquipmentSlot;
}

export interface RecipeMatch {
  recipeId: string;
  valid: boolean;
  matchedTags: string[];
  unlockedAffixCategories: AffixCategory[];
  reservedEnergy?: number;
  notes?: string[];
}

export type AffixSelectionStopReason =
  | 'budget_exhausted'
  | 'exclusive_group_conflict'
  | 'pool_exhausted'
  | 'max_count_reached';

export interface AffixAllocation {
  affixId: string;
  amount: number;
}

export interface AffixRejection {
  affixId: string;
  amount: number;
  reason: Exclude<AffixSelectionStopReason, 'pool_exhausted' | 'max_count_reached'>;
  exclusiveGroup?: string;
}

export interface AffixSelectionAudit {
  affixes: RolledAffix[];
  spent: number;
  remaining: number;
  allocations: AffixAllocation[];
  rejections: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
}

export interface EnergyBudget {
  total: number;
  reserved: number;
  spent: number;
  remaining: number;
  initialRemaining?: number;
  allocations: AffixAllocation[];
  rejections?: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
  sources: Array<{
    source: string;
    amount: number;
  }>;
}

export interface AffixCandidate {
  id: string;
  name: string;
  category: AffixCategory;
  tags: string[];
  weight: number;
  energyCost: number;
  exclusiveGroup?: string;
  minQuality?: Quality;
  maxQuality?: Quality;
}

export interface RolledAffix extends AffixCandidate {
  rollScore: number;
}

export interface CreationBlueprint {
  outcomeKind: CreationOutcomeKind;
  productModel: CreationProductModel;
  abilityConfig: AbilityConfig;
  name: string;
  description?: string;
  tags: string[];
  affixes: RolledAffix[];
}

export interface CraftedOutcome {
  productType: CreationProductType;
  outcomeKind: CreationOutcomeKind;
  blueprint: CreationBlueprint;
  productModel: CreationProductModel;
  abilityConfig: AbilityConfig;
  ability: Ability;
}

export interface CreationSessionState {
  id: string;
  phase: CreationPhase;
  input: CreationSessionInput;
  tags: string[];
  materialFingerprints: MaterialFingerprint[];
  intent?: CreationIntent;
  recipeMatch?: RecipeMatch;
  energyBudget?: EnergyBudget;
  affixPool: AffixCandidate[];
  rolledAffixes: RolledAffix[];
  blueprint?: CreationBlueprint;
  outcome?: CraftedOutcome;
  failureReason?: string;
}