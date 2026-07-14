import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type {
  AbilityConfig,
  AttributeModifierConfig,
  CombatResourceDefinition,
} from '@shared/engine/battle-v5/core/configs';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';

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
  levelBenefitDescription: string;
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

export interface SectAdmissionContext {
  playerRace: PlayerRaceId;
  realm: RealmType;
  stage: RealmStage;
}

export interface SectAdmissionResult {
  allowed: boolean;
  reason?: string;
}

export interface SectTrialContext {
  cultivator: Cultivator;
}

export interface SectTrialScenario {
  trainee: Cultivator;
  opponent: Cultivator;
}

export interface SectCompiledAbility {
  config: AbilityConfig;
  detailRows: string[];
  notes: string[];
}

export interface SectCompiledBuild {
  defaultAbilityId: SectAbilityId;
  abilities: Record<SectAbilityId, SectCompiledAbility>;
  resources: CombatResourceDefinition[];
  passives: AbilityConfig[];
}

export interface SectNodeBehaviorContext extends SectProjectionContext {
  path: CultivatorSectPathState;
  activeNodeIds: ReadonlySet<SectNodeId>;
}

export type SectNodeContributionOperation =
  | { type: 'set_default_ability'; abilityId: SectAbilityId }
  | { type: 'set_ability'; abilityId: SectAbilityId; ability: SectCompiledAbility }
  | { type: 'set_resources'; resources: CombatResourceDefinition[] }
  | { type: 'set_passives'; passives: AbilityConfig[] };

export interface SectNodeContribution {
  operations: SectNodeContributionOperation[];
}

export interface SectNodeBehavior {
  contribute(context: SectNodeBehaviorContext, build: Readonly<SectCompiledBuild>): SectNodeContribution;
}

export interface SectAbilityResolveContext extends SectProjectionContext {
  abilityId: SectAbilityId;
}

export interface SectPathModule {
  definition: SectPathDefinition;
  compileVariants(context: SectProjectionContext & { path: CultivatorSectPathState }, base: SectCompiledBuild): SectCompiledBuild;
  nodeBehaviors: Record<SectNodeId, SectNodeBehavior>;
  createSelectionStrategy(tacticId: SectTacticId): AbilitySelectionStrategy;
}

export interface SectModule {
  definition: SectDefinition;
  paths: Record<SectPathId, SectPathModule>;
  compileBase(context: SectProjectionContext): SectCompiledBuild;
  checkAdmission(context: SectAdmissionContext): SectAdmissionResult;
  createTrialScenario(context: SectTrialContext): SectTrialScenario;
}
