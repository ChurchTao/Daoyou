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
  'hybrid',
] as const;

export type PillFamily = (typeof PILL_FAMILY_VALUES)[number];

export const PILL_QUOTA_CATEGORY_VALUES = [
  'none',
  'long_term',
  'cultivation',
] as const;

export type PillQuotaCategory = (typeof PILL_QUOTA_CATEGORY_VALUES)[number];

export const ALCHEMY_MODE_VALUES = ['improvised', 'formula'] as const;

export type AlchemyMode = (typeof ALCHEMY_MODE_VALUES)[number];

export const ALCHEMY_PROPERTY_KEY_VALUES = [
  'restore_hp',
  'heal_wounds',
  'restore_mp',
  'detox',
  'cultivation',
  'insight',
  'clear_mind_support',
  'breakthrough_support',
  'tempering_vitality',
  'tempering_spirit',
  'tempering_wisdom',
  'tempering_speed',
  'tempering_willpower',
  'marrow_wash',
] as const;

export type AlchemyPropertyKey = (typeof ALCHEMY_PROPERTY_KEY_VALUES)[number];

export interface WeightedAlchemyProperty {
  key: AlchemyPropertyKey;
  weight: number;
}

export interface AlchemyMaterialPropertyVector {
  materialRef: string;
  materialName: string;
  properties: WeightedAlchemyProperty[];
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
      analysisVersion: 2;
      propertyVector: WeightedAlchemyProperty[];
      sourceMaterialVectors: AlchemyMaterialPropertyVector[];
      dominantElement?: ElementType;
      stability: number;
      toxicityRating: number;
      tags: string[];
      breakthroughTargetRealm?: RealmType;
      breakthroughLabel?: string;
    }
  | {
      source: 'formula';
      formulaId: string;
      sourceMaterials: string[];
      analysisVersion: 2;
      propertyVector: WeightedAlchemyProperty[];
      sourceMaterialVectors: AlchemyMaterialPropertyVector[];
      fitScore: number;
      fitMultiplier: number;
      dominantElement?: ElementType;
      stability: number;
      toxicityRating: number;
      tags: string[];
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

export type ConditionOperation =
  | RestoreResourceOperation
  | ChangeGaugeOperation
  | AddStatusOperation
  | RemoveStatusOperation
  | AdvanceTrackOperation
  | GainProgressOperation;

export interface PillSpec {
  kind: 'pill';
  family: PillFamily;
  operations: ConditionOperation[];
  consumeRules: PillConsumeRules;
  alchemyMeta: PillAlchemyMeta;
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

export type ConsumableSpec = PillSpec | TalismanSpec;

export interface AlchemyFormulaBlueprint {
  operations: ConditionOperation[];
  consumeRules: PillConsumeRules;
  targetStability: number;
  targetToxicity: number;
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
