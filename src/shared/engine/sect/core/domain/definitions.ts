import type { AttributeModifierConfig } from '@shared/engine/battle-v5/core/configs';
import type { RealmStage, RealmType } from '@shared/types/constants';

export type PlayerRaceId = 'human';
export type SectId = string;
export type SectMethodId = string;
export type SectAbilityId = string;
export type SectPathId = string;
export type SectPathLayerId = string;
export type SectNodeId = string;
export type SectTacticId = string;
export type SectAbilityRole =
  'generator' | 'combo' | 'defensive' | 'finisher' | 'utility';

export interface SectTrainingCost {
  cultivationExp: number;
  comprehensionInsight: number;
  spiritStones: number;
}

export interface SectRequirementDefinition {
  minRealm?: RealmType;
  minRealmStage?: RealmStage;
  requiredMethods?: Record<SectMethodId, number>;
}

export interface SectHeartMethodDefinition {
  id: SectMethodId;
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  description: string;
  isPrimary?: boolean;
  modifierPerLevel?: AttributeModifierConfig;
  perLevelDescription?: string;
}

export interface SectAbilityDefinition {
  id: SectAbilityId;
  methodId: SectMethodId;
  baseName: string;
  description: string;
  unlockLevel: number;
  occupiesActiveSlot: boolean;
  role: SectAbilityRole;
  mpCost: number;
  cooldown: number;
}

export interface SectMeridianNodeDefinition {
  id: SectNodeId;
  layerId: SectPathLayerId;
  name: string;
  description: string;
  requiredMethods?: Record<SectMethodId, number>;
}

export interface SectPathLayerDefinition extends SectRequirementDefinition {
  id: SectPathLayerId;
  order: number;
  label: string;
  cost: SectTrainingCost;
}

export interface SectTacticPreset {
  id: SectTacticId;
  name: string;
  description: string;
}

export interface SectPathPresentation {
  highlights: Array<{ name: string; description: string }>;
  abilityChanges: Partial<Record<SectAbilityId, string>>;
}

export interface SectPathDefinition {
  id: SectPathId;
  name: string;
  description: string;
  minRealm: RealmType;
  minRealmStage: RealmStage;
  defaultTacticId: SectTacticId;
  layers: SectPathLayerDefinition[];
  nodes: SectMeridianNodeDefinition[];
  tactics: SectTacticPreset[];
  presentation?: SectPathPresentation;
}

export interface SectOnboardingDefinition {
  initialContribution: number;
  initialMethods: Record<SectMethodId, number>;
  initialAbilityLoadout: [
    SectAbilityId | null,
    SectAbilityId | null,
    SectAbilityId | null,
    SectAbilityId | null,
  ];
}

export interface SectDefinition {
  id: SectId;
  name: string;
  description: string;
  trial: { name: string; description: string };
  raceIds: PlayerRaceId[];
  configVersion: number;
  combatResource: { id: string; name: string; icon?: string; max: number };
  methods: SectHeartMethodDefinition[];
  abilities: SectAbilityDefinition[];
  paths: SectPathDefinition[];
  onboarding: SectOnboardingDefinition;
}

export type SectDefinitionWithoutPaths = Omit<SectDefinition, 'paths'>;
export type SectPathDefinitionWithoutNodes = Omit<SectPathDefinition, 'nodes'>;
