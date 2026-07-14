import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type {
  AbilityConfig,
  AttributeModifierConfig,
  CombatResourceDefinition,
} from '@shared/engine/battle-v5/core/configs';
import type { RealmStage, RealmType } from '@shared/types/constants';

export type PlayerRaceId = 'human';
export type SectId = string;
export type SectMethodId = string;
export type SectAbilityId = string;
export type SectPathId = string;
export type SectNodeId = string;
export type SectTacticId = string;
export type SectMembershipStatus = 'prospect' | 'active';
export type SectAbilityRole = 'generator' | 'combo' | 'defensive' | 'finisher' | 'utility';
export type SectMeridianLayer = 1 | 2 | 3 | 4 | 5 | 'ultimate';

export type SectAbilitySlots = [
  SectAbilityId | null,
  SectAbilityId | null,
  SectAbilityId | null,
  SectAbilityId | null,
];

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
  multiplierPerLevel: number;
  defaultTacticId: SectTacticId;
  nodes: SectMeridianNodeDefinition[];
  tactics: SectTacticPreset[];
}

export interface SectOnboardingDefinition {
  initialContribution: number;
  initialMethods: Record<SectMethodId, number>;
  initialAbilityLoadout: SectAbilitySlots;
}

export interface SectDefinition {
  id: SectId;
  name: string;
  description: string;
  trial: {
    name: string;
    description: string;
  };
  raceIds: PlayerRaceId[];
  configVersion: number;
  methods: SectHeartMethodDefinition[];
  abilities: SectAbilityDefinition[];
  paths: SectPathDefinition[];
  onboarding: SectOnboardingDefinition;
}

export interface SectMeridianLoadoutState {
  slot: 1 | 2 | 3;
  nodeIds: SectNodeId[];
  version: number;
}

export interface CultivatorSectPathState {
  pathId: SectPathId;
  level: number;
  tacticId: SectTacticId;
  activeMeridianSlot: 1 | 2 | 3;
  meridianLoadouts: SectMeridianLoadoutState[];
}

export interface CultivatorSectState {
  membershipId: string;
  sectId: SectId;
  status: SectMembershipStatus;
  experiencedAt?: string;
  joinedAt?: string;
  activePathId?: SectPathId;
  contribution: number;
  configVersion: number;
  methods: Partial<Record<SectMethodId, number>>;
  paths: CultivatorSectPathState[];
  abilityLoadout: SectAbilitySlots;
}

export interface SectMethodModifierProjection {
  methodId: SectMethodId;
  methodName: string;
  level: number;
  modifiers: AttributeModifierConfig[];
}

export interface SectCombatProjection {
  defaultAttack?: AbilityConfig;
  abilities: AbilityConfig[];
  methodModifiers: SectMethodModifierProjection[];
  resources: CombatResourceDefinition[];
  selectionStrategy?: AbilitySelectionStrategy;
}

export interface ResolvedSectAbility {
  id: SectAbilityId;
  name: string;
  baseName: string;
  role: SectAbilityRole;
  summary: string;
  unlocked: boolean;
  unlockRequirements: string[];
  manaCost: number;
  cooldown: number;
  detailRows: string[];
  notes: string[];
  config: AbilityConfig;
}

export interface SectProjectionContext {
  sect: CultivatorSectState;
  realm: RealmType;
}

export interface SectAbilityResolveContext extends SectProjectionContext {
  abilityId: SectAbilityId;
}

export interface SectTrialPreset {
  methods: Record<SectMethodId, number>;
  abilityLoadout: SectAbilitySlots;
  opponentName: string;
}

export interface SectPathModule {
  definition: SectPathDefinition;
  behaviorIds: readonly SectNodeId[];
  projectCombat(context: SectProjectionContext): SectCombatProjection | null;
  resolveAbility(context: SectAbilityResolveContext): ResolvedSectAbility;
  createSelectionStrategy(tacticId: SectTacticId): AbilitySelectionStrategy;
}

export interface SectModule {
  definition: SectDefinition;
  paths: Record<SectPathId, SectPathModule>;
  trial: SectTrialPreset;
  projectCombat(context: SectProjectionContext): SectCombatProjection | null;
  resolveAbility(context: SectAbilityResolveContext): ResolvedSectAbility;
}
