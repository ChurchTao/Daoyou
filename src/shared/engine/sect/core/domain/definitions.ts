import type { AttributeModifierConfig } from '@shared/engine/battle-v5/core/configs';
import type { RealmStage, RealmType } from '@shared/types/constants';

export type PlayerRaceId = 'human';
export type SectId = string;
export type SectMethodId = string;
export type SectAbilityId = string;
export type SectPathId = string;
export type SectNodeId = string;
export type SectTacticId = string;
export type SectAbilityRole =
  'generator' | 'combo' | 'defensive' | 'finisher' | 'utility';
export type SectMeridianLayer = 1 | 2 | 3 | 4 | 5 | 'ultimate';

export interface PlayerRaceDefinition {
  id: PlayerRaceId;
  name: string;
  description: string;
}

export interface SectRequirementDefinition {
  minRealm?: RealmType;
  minRealmStage?: RealmStage;
  minPathLevel?: number;
  requiredMethods?: Record<SectMethodId, number>;
}

export interface SectMethodMilestoneDefinition extends SectRequirementDefinition {
  id: string;
  level: number;
  name: string;
  description: string;
  abilityId?: SectAbilityId;
}

export interface SectHeartMethodDefinition {
  id: SectMethodId;
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  description: string;
  isPrimary?: boolean;
  modifierPerLevel?: AttributeModifierConfig;
  perLevelDescription?: string;
  milestones: SectMethodMilestoneDefinition[];
}

export interface SectAbilityDefinition {
  id: SectAbilityId;
  methodId: SectMethodId;
  baseName: string;
  description: string;
  unlockLevel: number;
  occupiesActiveSlot: boolean;
  role: SectAbilityRole;
  manaWeight: number;
  cooldown: number;
}

export interface SectMeridianNodeDefinition extends SectRequirementDefinition {
  id: SectNodeId;
  layer: SectMeridianLayer;
  name: string;
  description: string;
}

export interface SectTacticPreset {
  id: SectTacticId;
  name: string;
  description: string;
}

export interface SectPathDefinition {
  id: SectPathId;
  name: string;
  description: string;
  levelBenefitDescription: string;
  defaultTacticId: SectTacticId;
  nodes: SectMeridianNodeDefinition[];
  tactics: SectTacticPreset[];
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
  methods: SectHeartMethodDefinition[];
  abilities: SectAbilityDefinition[];
  paths: SectPathDefinition[];
  onboarding: SectOnboardingDefinition;
}

export type SectDefinitionWithoutPaths = Omit<SectDefinition, 'paths'>;
export type SectPathDefinitionWithoutNodes = Omit<SectPathDefinition, 'nodes'>;
