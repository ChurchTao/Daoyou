import {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import { Material } from '@shared/types/cultivator';
import type { TargetPolicyConfig } from '@shared/engine/battle-v5/abilities/TargetPolicy';
import type { Ability } from './contracts/battle';
import type { AttributeModifierConfig } from './contracts/battle';
import { CreationPhase } from './core/types';
import type { CreationProductModel } from './models/types';
import type { AffixTagMatcher } from './affixes/types';
import type {
  AffixPoolDecision,
  AffixSelectionDecision,
} from './rules/contracts';
import type { RuleTraceEntry } from './rules/core/types';
import type { ExclusiveGroup } from './affixes/exclusiveGroups';

export type CreationProductType = 'skill' | 'artifact' | 'gongfa';

export type AffixSlot = 'core' | 'identity' | 'resonance' | 'modifier';

export type AffixRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type GongfaAffixRole = 'primary' | 'support' | 'resonance' | 'secret';

export interface GongfaAffixSelectionMeta {
  role: GongfaAffixRole;
  archetype: string;
  element?: ElementType;
  resonanceElements?: ElementType[];
}

export interface AffixSelectionMeta {
  gongfa?: GongfaAffixSelectionMeta;
}


export const CREATION_PRODUCT_TYPES = ['skill', 'artifact', 'gongfa'] as const;

export function isCreationProductType(
  value: string,
): value is CreationProductType {
  return (CREATION_PRODUCT_TYPES as readonly string[]).includes(value);
}

export interface CreationSessionInput {
  sessionId?: string;
  slugSeed?: string;
  cultivatorId?: string;
  creatorName?: string;
  realm?: RealmType;
  realmStage?: RealmStage;
  productType: CreationProductType;
  materials: Material[];
  userPrompt?: string;
  contextPositiveTagBiases?: CreationContextTagBias[];
  contextNegativeTagBiases?: CreationContextTagBias[];
  requestedSlot?: EquipmentSlot;
  requestedTargetPolicy?: TargetPolicyConfig;
  projectionContext?: CreationSkillProjectionContext;
}

export interface CreationContextTagBias {
  tag: string;
  weight: number;
}

export type CreationProjectionOwnerKind = 'player' | 'enemy';
export type CreationSkillPaceProfile = 'standard' | 'aggressive' | 'sustain';
export type CreationSkillProjectionRole =
  | 'offense'
  | 'control'
  | 'guard'
  | 'sustain';

export interface CreationSkillProjectionContext {
  ownerKind: CreationProjectionOwnerKind;
  difficulty?: number;
  role?: CreationSkillProjectionRole;
  paceProfile?: CreationSkillPaceProfile;
}

export interface IntentCraftInput {
  sessionId?: string;
  cultivatorId?: string;
  creatorName?: string;
  realm?: RealmType;
  realmStage?: RealmStage;
  productType: CreationProductType;
  energyBudget: number;
  unlockScore: number;
  dominantTags: string[];
  positiveTagBiases?: CreationContextTagBias[];
  negativeTagBiases?: CreationContextTagBias[];
  elementBias?: ElementType;
  requestedSlot?: EquipmentSlot;
  requestedTargetPolicy?: TargetPolicyConfig;
  userPrompt?: string;
  seed: number | string;
  slugSeed: string;
  stableOutputKey: string;
  maxAffixCount?: number;
  excludedAffixIds?: string[];
  projectionContext?: CreationSkillProjectionContext;
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

export interface ProductNamingLLMMetadata {
  status: 'success' | 'fallback';
  styleInsight?: string;
  originalName?: string;
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

export type CreationTagSignalSource =
  | 'material_explicit'
  | 'material_semantic'
  | 'material_recipe'
  | 'intent_dominant'
  | 'intent_positive_bias'
  | 'recipe_matched';

export interface CreationTagSignal {
  tag: string;
  source: CreationTagSignalSource;
  weight: number;
}

export interface CreationIntent {
  productType: CreationProductType;
  dominantTags: string[];
  positiveTagBiases?: CreationContextTagBias[];
  negativeTagBiases?: CreationContextTagBias[];
  elementBias?: ElementType;
  slotBias?: EquipmentSlot;
  slotBiasSource?: CreationIntentSlotBiasSource;
  targetPolicyBias?: TargetPolicyConfig;
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
  unlockedAffixRarities: AffixRarity[];
  reservedEnergy?: number;
  notes?: string[];
}

export type AffixSelectionStopReason =
  | 'budget_exhausted'
  | 'exclusive_group_conflict'
  | 'ability_tag_conflict'
  | 'slot_incompatible'
  | 'pool_exhausted'
  | 'max_count_reached';

export const AFFIX_STOP_REASONS = {
  BUDGET_EXHAUSTED: 'budget_exhausted',
  EXCLUSIVE_GROUP_CONFLICT: 'exclusive_group_conflict',
  ABILITY_TAG_CONFLICT: 'ability_tag_conflict',
  SLOT_INCOMPATIBLE: 'slot_incompatible',
  POOL_EXHAUSTED: 'pool_exhausted',
  MAX_COUNT_REACHED: 'max_count_reached',
} as const satisfies Record<string, AffixSelectionStopReason>;

/** Rule evaluation phase identifiers — used in RuleContext metadata */
export const CREATION_RULE_PHASES = {
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
  exclusiveGroup?: ExclusiveGroup;
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

export interface EnergyBudget {
  baseTotal: number;
  effectiveTotal: number;
  reserved: number;
  initialRemaining?: number;
  sources: Array<{
    source: string;
    amount: number;
  }>;
  spent: number;
  remaining: number;
  allocations: AffixAllocation[];
  rejections?: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
}

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
  description?: string;
  slot: AffixSlot;
  rarity: AffixRarity;
  match: AffixTagMatcher;
  tags: string[];
  grantedAbilityTags?: string[];
  weight: number;
  energyCost: number;
  evaluationScore?: number;
  exclusiveGroup?: ExclusiveGroup;
  applicableArtifactSlots?: EquipmentSlot[];
  targetPolicyConstraint?: Partial<TargetPolicyConfig>;
  selectionMeta?: AffixSelectionMeta;
  effectTemplate: AffixEffectTemplate;
}

export interface AffixModifierSelection {
  attrType: AttributeModifierConfig['attrType'];
  type: AttributeModifierConfig['type'];
}

export interface RolledAffix extends AffixCandidate {
  rollScore: number;
  rollEfficiency: number; // 0.0 - 1.0 之间的效率分
  finalMultiplier: number; // 最终随到的数值倍率（如 1.12）
  isPerfect: boolean; // 是否触发了“完美”标记
  /**
   * random_attribute_modifier 的随机选择结果。
   * 仅记录选中的属性与 modifier 类型；数值在 rehydrate 时从公式实时重算。
   */
  modifierSelections?: AffixModifierSelection[];
  /** @deprecated 旧 productModel 兼容字段；读取时仅使用 attrType/type，忽略 value。 */
  resolvedModifiers?: AttributeModifierConfig[];
}

export interface CreationBlueprint {
  productType: CreationProductType;
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
  inputTagSignals: CreationTagSignal[];
  inputTags: string[];
  intentCraftMeta?: {
    maxAffixCount?: number;
    excludedAffixIds?: string[];
    selectionSeed?: string | number;
    rng?: () => number;
    stableOutputKey?: string;
    suppressLogs?: boolean;
    projectionContext?: CreationSkillProjectionContext;
  };

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
  namingMetadata?: ProductNamingLLMMetadata;

  // ── 阶段 8：产物实体化 ──────────────────────────────────────────────────────
  outcome?: CraftedOutcome;

  // ── 错误状态 ────────────────────────────────────────────────────────────────
  failureReason?: string;
}
