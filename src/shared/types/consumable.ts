import type {
  ConditionStatusDuration,
  ConditionStatusKey,
  ConditionTrackPath,
} from './condition';
import type { ElementType, Quality, RealmType } from './constants';

export const PILL_FAMILY_VALUES = [
  'healing',
  'mana',
  'detox',
  'cultivation',
  'insight',
  'breakthrough',
  'tempering',
  'marrow_wash',
  'longevity',
  'hybrid',
] as const;

export type PillFamily = (typeof PILL_FAMILY_VALUES)[number];

export const PILL_QUOTA_CATEGORY_VALUES = [
  'none',
  'long_term',
  'cultivation',
  'longevity',
] as const;

export type PillQuotaCategory = (typeof PILL_QUOTA_CATEGORY_VALUES)[number];

export const ALCHEMY_MODE_VALUES = ['improvised', 'formula'] as const;

export type AlchemyMode = (typeof ALCHEMY_MODE_VALUES)[number];

export const PILL_APPEARANCE_GRADE_VALUES = [
  'low',
  'middle',
  'high',
  'perfect',
] as const;

export type PillAppearanceGrade = (typeof PILL_APPEARANCE_GRADE_VALUES)[number];

export const ALCHEMY_PROPERTY_KEY_VALUES = [
  'restore_hp',
  'heal_wounds',
  'restore_mp',
  'detox',
  'cultivation',
  'insight',
  'clear_mind_support',
  'protect_meridians_support',
  'breakthrough_support',
  'extend_lifespan',
  'body_skin',
  'body_sinew_bone',
  'body_organs',
  'body_qi_blood',
  'body_primordial_spirit',
  'marrow_wash',
] as const;

export type AlchemyPropertyKey = (typeof ALCHEMY_PROPERTY_KEY_VALUES)[number];

export const LEGACY_ALCHEMY_PROPERTY_KEY_VALUES = [
  'tempering_vitality',
  'tempering_spirit',
  'tempering_wisdom',
  'tempering_speed',
  'tempering_willpower',
] as const;

export type LegacyAlchemyPropertyKey =
  (typeof LEGACY_ALCHEMY_PROPERTY_KEY_VALUES)[number];

export type CompatibleAlchemyPropertyKey =
  AlchemyPropertyKey | LegacyAlchemyPropertyKey;

export interface WeightedAlchemyProperty {
  key: AlchemyPropertyKey;
  weight: number;
}

export interface CompatibleWeightedAlchemyProperty {
  key: CompatibleAlchemyPropertyKey;
  weight: number;
}

export interface AlchemyMaterialPropertyVector {
  materialRef: string;
  materialName: string;
  properties: WeightedAlchemyProperty[];
}

export interface AlchemyEssenceSummary {
  rawEssence: number;
  effectiveEssence: number;
  qualityPotential: number;
  purity: number;
  stability: number;
}

export interface AlchemyOutputLot {
  quality: Quality;
  appearance: PillAppearanceGrade;
  quantity: number;
  essenceSpent: number;
  effectMultiplier: number;
}

export interface AlchemyYieldProfile {
  essence: AlchemyEssenceSummary;
  primaryQuality: Quality;
  lots: AlchemyOutputLot[];
  totalQuantity: number;
  wastedEssence: number;
  essenceLossRatio?: number;
  distributionSummary: string;
}

export interface AlchemyYieldDisplayProfile {
  primaryQuality: Quality;
  lots: Array<
    Pick<
      AlchemyOutputLot,
      'quality' | 'appearance' | 'quantity' | 'effectMultiplier'
    >
  >;
  totalQuantity: number;
  essenceLossRatio: number;
  distributionSummary: string;
}

export const ALCHEMY_COMPOUND_TIER_VALUES = [
  'single',
  'balanced',
  'synergy',
  'conflict',
] as const;

export type AlchemyCompoundTier = (typeof ALCHEMY_COMPOUND_TIER_VALUES)[number];

export interface AlchemyBatchProfile {
  /** @deprecated 新炼丹产量由 yieldProfile/批次引擎决定。仅兼容历史数据。 */
  yieldQuantity?: number;
  lotQuantity?: number;
  synergyScore: number;
  conflictScore: number;
  compoundTier: AlchemyCompoundTier;
  roleSummary: string;
  stabilityDelta: number;
  toxicityDelta: number;
  /** @deprecated v4 效果槽位倍率固定，不再接受批次加成。 */
  secondaryEffectMultiplierBonus?: number;
  essenceSummary?: AlchemyEssenceSummary;
  yieldProfile?: AlchemyYieldProfile;
  essenceLossRatio?: number;
}

/** 面向玩家的丹方推演摘要；不得包含药蕴绝对值或内部炉况参数。 */
export interface AlchemyBatchDisplayProfile {
  compoundTier: AlchemyCompoundTier;
  roleSummary: string;
  totalQuantityRange: { min: number; max: number };
  primaryQualityRange: { min: Quality; max: Quality };
  possibleQualities: Quality[];
  appearanceHints: Partial<Record<PillAppearanceGrade, number>>;
  essenceLossRatioRange: { min: number; max: number };
  summary: string;
  warnings: string[];
}

export const FORMULA_MATERIAL_VERDICT_VALUES = [
  'core',
  'usable',
  'conflict',
] as const;

export type FormulaMaterialVerdict =
  (typeof FORMULA_MATERIAL_VERDICT_VALUES)[number];

export const FORMULA_FIT_BAND_VALUES = ['aligned', 'degraded', 'poor'] as const;

export type FormulaFitBand = (typeof FORMULA_FIT_BAND_VALUES)[number];

export interface FormulaMaterialJudgment {
  materialId: string;
  materialName: string;
  verdict: FormulaMaterialVerdict;
  reason: string;
}

export const ALCHEMY_FOCUS_MODE_VALUES = [
  'focused',
  'balanced',
  'risky',
] as const;

export type AlchemyFocusMode = (typeof ALCHEMY_FOCUS_MODE_VALUES)[number];

export interface AlchemyRecipePlan {
  materialVectors: AlchemyMaterialPropertyVector[];
  intentVector: WeightedAlchemyProperty[];
  focusMode: AlchemyFocusMode;
  requestedElementBias?: ElementType;
}

export interface PillConsumeRules {
  scene: 'out_of_battle_only';
  quotaCategory: PillQuotaCategory;
}

export type PillAlchemyMeta =
  | {
      source: 'improvised';
      formulaId?: never;
      sourceMaterials: string[];
      analysisVersion?: number;
      propertyVector?: WeightedAlchemyProperty[];
      sourceMaterialVectors?: AlchemyMaterialPropertyVector[];
      dominantElement?: ElementType;
      stability: number;
      toxicityRating: number;
      appearance?: PillAppearanceGrade;
      tags: string[];
      batch?: AlchemyBatchProfile;
      version?: 3 | 4;
      breakthroughTargetRealm?: RealmType;
      breakthroughLabel?: string;
    }
  | {
      source: 'formula';
      formulaId: string;
      sourceMaterials: string[];
      analysisVersion?: number;
      propertyVector?: WeightedAlchemyProperty[];
      sourceMaterialVectors?: AlchemyMaterialPropertyVector[];
      fitScore: number;
      fitBand: FormulaFitBand;
      fitMultiplier: number;
      dominantElement?: ElementType;
      stability: number;
      toxicityRating: number;
      appearance?: PillAppearanceGrade;
      tags: string[];
      batch?: AlchemyBatchProfile;
      version?: 3 | 4;
      breakthroughTargetRealm?: RealmType;
      breakthroughLabel?: string;
    };

export interface RestoreResourceOperation {
  type: 'restore_resource';
  resource: 'hp' | 'mp';
  mode: 'flat' | 'percent';
  value: number;
}

export interface ChangeGaugeOperation {
  type: 'change_gauge';
  gauge: 'pillToxicity';
  delta: number;
}

export interface AddStatusOperation {
  type: 'add_status';
  status: ConditionStatusKey;
  stacks?: number;
  duration?: ConditionStatusDuration;
  usesRemaining?: number;
  payload?: Record<string, number | string | boolean>;
}

export interface RemoveStatusOperation {
  type: 'remove_status';
  status: ConditionStatusKey;
  removeAll?: boolean;
}

export interface AdvanceTrackOperation {
  type: 'advance_track';
  track: ConditionTrackPath;
  value: number;
}

export interface GainProgressOperation {
  type: 'gain_progress';
  target: 'cultivation_exp' | 'comprehension_insight';
  value: number;
}

export interface IncreaseLifespanOperation {
  type: 'increase_lifespan';
  value: number;
}

export type ConditionOperation =
  | RestoreResourceOperation
  | ChangeGaugeOperation
  | AddStatusOperation
  | RemoveStatusOperation
  | AdvanceTrackOperation
  | GainProgressOperation
  | IncreaseLifespanOperation;

export interface PillSpec {
  kind: 'pill';
  family: PillFamily;
  operations: ConditionOperation[];
  consumeRules: PillConsumeRules;
  alchemyMeta: PillAlchemyMeta;
}

/** 灵果复用丹药的效果协议，但不携带炼丹元数据、丹毒或服用额度。 */
export interface SpiritFruitSpec {
  kind: 'spirit_fruit';
  family: PillFamily;
  operations: ConditionOperation[];
  consumeRules: PillConsumeRules;
  source: {
    kind: 'spirit_field';
    version: 1;
  };
}

export interface AlchemyFormulaMastery {
  level: number;
  exp: number;
}

export interface AlchemyFormulaPattern {
  targetPropertyVector: WeightedAlchemyProperty[];
  dominantElement?: ElementType;
  minQuality?: Quality;
  slotCount: number;
}

export const TALISMAN_SESSION_MODE_VALUES = [
  'lock_on_enter_settle_on_exit',
  'consume_on_action',
] as const;

export type TalismanSessionMode = (typeof TALISMAN_SESSION_MODE_VALUES)[number];

export interface TalismanSpec {
  kind: 'talisman';
  scenario: string;
  sessionMode: TalismanSessionMode;
  notes?: string;
}

export type ConsumableSpec = PillSpec | SpiritFruitSpec | TalismanSpec;

export interface AlchemyFormulaBlueprint {
  version: 4;
  route: AlchemyEffectRoute;
  needsRebirth?: boolean;
  consumeRules: PillConsumeRules;
  targetStability: number;
  targetToxicity: number;
}

export type AlchemyEffectKey = AlchemyPropertyKey;

export interface AlchemyEffectRoute {
  effects: Array<{ key: AlchemyEffectKey; weight: number }>;
}

export interface FormulaAnalysisResult {
  analysisId: string;
  valid: boolean;
  staticBlockingReason?: string;
  /** LLM 裁决档位对应的服务端代表值；仅兼容既有丹药元数据。 */
  fitScore: number;
  fitBand: FormulaFitBand;
  conclusion?: string;
  warnings: string[];
  materialJudgments: FormulaMaterialJudgment[];
  batchProfile?: AlchemyBatchDisplayProfile;
  dominantElement?: ElementType;
  stability: number;
  toxicityRating: number;
  cooldownRemainingSeconds: number;
  expiresInSeconds: number;
}

export interface AlchemyFormula {
  id: string;
  cultivatorId: string;
  name: string;
  description: string;
  family: PillFamily;
  pattern: AlchemyFormulaPattern;
  blueprint: AlchemyFormulaBlueprint;
  mastery: AlchemyFormulaMastery;
  createdAt: string;
  updatedAt: string;
}

export interface AlchemyFormulaDiscoveryCandidate {
  token: string;
  name: string;
  description: string;
  family: PillFamily;
  discoveryRemark: string;
  patternSummary: string;
}
