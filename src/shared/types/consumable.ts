import type { ConditionStatusDuration, ConditionStatusKey, ConditionTrackPath } from './condition';
import type { ElementType, Quality } from './constants';

export const PILL_FAMILY_VALUES = [
  'healing',
  'mana',
  'detox',
  'breakthrough',
  'tempering',
  'marrow_wash',
  'hybrid',
] as const;

export type PillFamily = (typeof PILL_FAMILY_VALUES)[number];

export const ALCHEMY_MODE_VALUES = [
  'improvised',
  'formula',
] as const;

export type AlchemyMode = (typeof ALCHEMY_MODE_VALUES)[number];

export interface PillConsumeRules {
  scene: 'out_of_battle_only';
  countsTowardLongTermQuota: boolean;
}

export type PillAlchemyMeta =
  | {
      source: 'improvised';
      formulaId?: never;
      sourceMaterials: string[];
      dominantElement?: ElementType;
      stability: number;
      toxicityRating: number;
      tags: string[];
    }
  | {
      source: 'formula';
      formulaId: string;
      sourceMaterials: string[];
      dominantElement?: ElementType;
      stability: number;
      toxicityRating: number;
      tags: string[];
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

export type ConditionOperation =
  | RestoreResourceOperation
  | ChangeGaugeOperation
  | AddStatusOperation
  | RemoveStatusOperation
  | AdvanceTrackOperation;

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
  requiredTags: MaterialAlchemyEffectTag[];
  optionalTags?: MaterialAlchemyEffectTag[];
  dominantElement?: ElementType;
  minQuality?: Quality;
  slotCount: number;
}

export const TALISMAN_SESSION_MODE_VALUES = [
  'lock_on_enter_settle_on_exit',
  'consume_on_action',
] as const;

export type TalismanSessionMode =
  (typeof TALISMAN_SESSION_MODE_VALUES)[number];

export interface TalismanSpec {
  kind: 'talisman';
  scenario: string;
  sessionMode: TalismanSessionMode;
  notes?: string;
}

export type ConsumableSpec = PillSpec | TalismanSpec;

export const MATERIAL_ALCHEMY_EFFECT_TAG_VALUES = [
  'healing',
  'mana',
  'detox',
  'breakthrough',
  'tempering_vitality',
  'tempering_spirit',
  'tempering_wisdom',
  'tempering_speed',
  'tempering_willpower',
  'marrow_wash',
] as const;

export type MaterialAlchemyEffectTag =
  (typeof MATERIAL_ALCHEMY_EFFECT_TAG_VALUES)[number];

export interface MaterialAlchemyProfile {
  effectTags: MaterialAlchemyEffectTag[];
  elementBias?: ElementType;
  potency: number;
  toxicity: number;
  stability: number;
}

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
  family: PillFamily;
  patternSummary: string;
}
