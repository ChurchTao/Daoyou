import {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmType,
} from '@/types/constants';
import { Material } from '@/types/cultivator';
import type { Ability } from './contracts/battle';
import { CreationPhase } from './core/types';
import type { CreationProductModel } from './models/types';
import type {
  AffixPoolDecision,
  AffixSelectionDecision,
} from './rules/contracts';
import type { RuleTraceEntry } from './rules/core/types';

export type CreationProductType = 'skill' | 'artifact' | 'gongfa';
export type CreationOutcomeKind = 'active_skill' | 'artifact' | 'gongfa';
export type AffixCategory =
  | 'prefix'
  | 'suffix'
  | 'core'
  | 'signature'
  | 'resonance'
  | 'synergy'
  | 'mythic';

export const AFFIX_CATEGORIES = {
  PREFIX: 'prefix',
  SUFFIX: 'suffix',
  CORE: 'core',
  SIGNATURE: 'signature',
  RESONANCE: 'resonance',
  SYNERGY: 'synergy',
  MYTHIC: 'mythic',
} as const satisfies Record<string, AffixCategory>;

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

export interface MaterialEnergyProfile {
  baseEnergy: number;
  diversityBonus: number;
  coherenceBonus: number;
  effectiveEnergy: number;
  unlockScore: number;
}

export interface MaterialQualityProfile {
  maxQuality: Quality;
  weightedAverageQuality: Quality;
  minQuality: Quality;
  maxQualityOrder: number;
  weightedAverageOrder: number;
  minQualityOrder: number;
  qualitySpread: number;
  totalQuantity: number;
}

export interface CreationIntent {
  productType: CreationProductType;
  outcomeKind: CreationOutcomeKind;
  dominantTags: string[];
  requestedTags: string[];
  elementBias?: ElementType;
  slotBias?: EquipmentSlot;
  slotBiasSource?: CreationIntentSlotBiasSource;
  trace?: RuleTraceEntry[];
}

export type CreationIntentSlotBiasSource =
  | 'requested'
  | 'inferred_keyword_armor'
  | 'inferred_keyword_accessory'
  | 'default_weapon_fallback';

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
  | 'category_quota_reached'
  | 'pool_exhausted'
  | 'max_count_reached';

export const AFFIX_STOP_REASONS = {
  BUDGET_EXHAUSTED: 'budget_exhausted',
  EXCLUSIVE_GROUP_CONFLICT: 'exclusive_group_conflict',
  CATEGORY_QUOTA_REACHED: 'category_quota_reached',
  POOL_EXHAUSTED: 'pool_exhausted',
  MAX_COUNT_REACHED: 'max_count_reached',
} as const satisfies Record<string, AffixSelectionStopReason>;

/** Rule evaluation phase identifiers — used in RuleContext metadata */
export const CREATION_PHASES = {
  MATERIAL_VALIDATION: 'material_validation',
  RECIPE_VALIDATION: 'recipe_validation',
  AFFIX_POOL_BUILD: 'affix_pool_build',
  AFFIX_SELECTION: 'affix_selection',
} as const;

/** Factory helpers for well-known RecipeId patterns */
export function defaultRecipeId(productType: CreationProductType): string {
  return `${productType}-default`;
}

export function conflictedRecipeId(productType: CreationProductType): string {
  return `${productType}-conflicted`;
}

export interface AffixAllocation {
  affixId: string;
  amount: number;
}

export interface AffixRejection {
  affixId: string;
  amount: number;
  reason: Exclude<
    AffixSelectionStopReason,
    'pool_exhausted' | 'max_count_reached'
  >;
  exclusiveGroup?: string;
}

export interface AffixSelectionRoundAudit {
  round: number;
  remainingBefore: number;
  remainingAfter: number;
  inputCandidates: AffixCandidate[];
  decision: AffixSelectionDecision;
  pickedAffix?: RolledAffix;
}

export interface AffixSelectionAudit {
  rounds: AffixSelectionRoundAudit[];
  affixes: RolledAffix[];
  spent: number;
  remaining: number;
  allocations: AffixAllocation[];
  rejections: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
  finalDecision?: AffixSelectionDecision;
}

export interface EnergyBudgetAllocation {
  baseTotal: number;
  effectiveTotal: number;
  reserved: number;
  initialRemaining?: number;
  sources: Array<{
    source: string;
    amount: number;
  }>;
}

export interface EnergyBudgetLedger {
  spent: number;
  remaining: number;
  allocations: AffixAllocation[];
  rejections?: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
}

export interface EnergyBudget extends EnergyBudgetAllocation, EnergyBudgetLedger {}

/** Returns a zero-value EnergyBudget for cases where session budget is unavailable */
export function createEmptyEnergyBudget(): EnergyBudget {
  return {
    baseTotal: 0,
    effectiveTotal: 0,
    reserved: 0,
    spent: 0,
    remaining: 0,
    allocations: [],
    sources: [],
  };
}

import type { AffixEffectTemplate } from './affixes/types';

export interface AffixCandidate {
  id: string;
  name: string;
  category: AffixCategory;
  tags: string[];
  inherentTags?: string[];
  weight: number;
  energyCost: number;
  evaluationScore?: number;
  exclusiveGroup?: string;
  minQuality?: Quality;
  maxQuality?: Quality;
  effectTemplate: AffixEffectTemplate;
}

export interface RolledAffix extends AffixCandidate {
  rollScore: number;
  rollEfficiency: number; // 0.0 - 1.0 之间的效率分
  finalMultiplier: number; // 最终随到的数值倍率（如 1.12）
  isPerfect: boolean; // 是否触发了“完美”标记
}

export interface CreationBlueprint {
  outcomeKind: CreationOutcomeKind;
  productModel: CreationProductModel;
}

export interface CraftedOutcome {
  blueprint: CreationBlueprint;
  ability: Ability;
}

export interface CreationSessionState {
  // ── 会话元数据 ──────────────────────────────────────────────────────────────
  id: string;
  phase: CreationPhase;
  input: CreationSessionInput;
  tags: string[];

  // ── 阶段 1：材料分析 ────────────────────────────────────────────────────────
  materialFingerprints: MaterialFingerprint[];

  // ── 阶段 2：意图解析 ────────────────────────────────────────────────────────
  intent?: CreationIntent;

  // ── 阶段 3：配方校验 ────────────────────────────────────────────────────────
  recipeMatch?: RecipeMatch;

  // ── 阶段 4：能量预算 ────────────────────────────────────────────────────────
  energyBudget?: EnergyBudget;

  // ── 阶段 5：词缀池构建 ──────────────────────────────────────────────────────
  affixPool: AffixCandidate[];
  affixPoolDecision?: AffixPoolDecision;

  // ── 阶段 6：词缀抽选 ────────────────────────────────────────────────────────
  rolledAffixes: RolledAffix[];
  affixSelectionAudit?: AffixSelectionAudit;
  affixSelectionFinalDecision?: AffixSelectionDecision;

  // ── 阶段 7：蓝图组合 ────────────────────────────────────────────────────────
  blueprint?: CreationBlueprint;

  // ── 阶段 8：产物实体化 ──────────────────────────────────────────────────────
  outcome?: CraftedOutcome;

  // ── 错误状态 ────────────────────────────────────────────────────────────────
  failureReason?: string;
}
