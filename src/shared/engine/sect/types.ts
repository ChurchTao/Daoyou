import type { AbilityConfig, AttributeModifierConfig } from '@shared/engine/battle-v5/core/configs';
import type { RealmStage, RealmType } from '@shared/types/constants';

export type PlayerRaceId = 'human';
export type SectId = 'lingxiao';
export type SectPathId = 'swift-sword';
export type SectMembershipStatus = 'prospect' | 'active';
export type SectTacticId = 'aggressive' | 'steady' | 'counter';
export type SectSelectionStrategyId = 'sect.lingxiao.sword.v1';
export type SectAbilityRole = 'generator' | 'combo' | 'defensive' | 'finisher';

export type LingxiaoMethodId =
  | 'lingxiao-canon'
  | 'sword-guidance'
  | 'void-step'
  | 'edge-cleansing'
  | 'origin-returning'
  | 'swift-sword-canon';

export type LingxiaoAbilityId =
  | 'plain-sword'
  | 'guiding-sword'
  | 'linked-edge'
  | 'turning-body'
  | 'breaking-edge'
  | 'sword-aegis'
  | 'shadow-step'
  | 'instant-traceless';

export type SectAbilitySlots = [
  LingxiaoAbilityId | null,
  LingxiaoAbilityId | null,
  LingxiaoAbilityId | null,
  LingxiaoAbilityId | null,
];

export interface PlayerRaceDefinition {
  id: PlayerRaceId;
  name: string;
  description: string;
}

export interface SectHeartMethodDefinition {
  id: LingxiaoMethodId;
  name: string;
  description: string;
  parentMethodId?: LingxiaoMethodId;
  modifierPerLevel?: AttributeModifierConfig;
  swiftTemplateMultiplierPerLevel?: number;
  perLevelDescription?: string;
  milestones: SectMethodMilestoneDefinition[];
}

export interface SectMethodMilestoneDefinition {
  id: string;
  level: number;
  name: string;
  description: string;
  abilityId?: LingxiaoAbilityId;
  minRealm?: RealmType;
  minRealmStage?: RealmStage;
  requiredPathId?: SectPathId;
  requiredMethods?: Partial<Record<LingxiaoMethodId, number>>;
}

export interface SectAbilityEffectDefinition {
  damageCoefficient?: number;
  momentumDamageCoefficient?: number;
  swordMarkDamageCoefficient?: number;
  lowHpBonusCoefficient?: number;
  hits?: number;
  momentumGain?: number;
  momentumRequired?: number;
  consumesAllMomentum?: boolean;
  swordMarkLayers?: number;
  consumesSwordMarks?: boolean;
  shieldCoefficient?: number;
  counterCoefficient?: number;
  speedBonus?: number;
  forcedCritical?: boolean;
}

export interface SectAbilityDefinition {
  id: LingxiaoAbilityId;
  baseName: string;
  swiftName?: string;
  description: string;
  unlock: {
    methodId: LingxiaoMethodId;
    level: number;
    pathId?: SectPathId;
    primaryMethodLevel?: number;
  };
  occupiesActiveSlot: boolean;
  role: SectAbilityRole;
  manaWeight: number;
  cooldown: number;
  baseEffect: SectAbilityEffectDefinition;
  swiftEffect?: SectAbilityEffectDefinition;
}

export interface SectMeridianNodeDefinition {
  id: string;
  layer: 1 | 2 | 3 | 4 | 5 | 'ultimate';
  name: string;
  description: string;
  minRealm: RealmType;
  minRealmStage: RealmStage;
  requiredMethods?: Partial<Record<LingxiaoMethodId, number>>;
}

export interface SectPathDefinition {
  id: SectPathId;
  name: string;
  description: string;
  nodes: SectMeridianNodeDefinition[];
}

export interface SectTacticPreset {
  id: SectTacticId;
  name: string;
  description: string;
}

export interface SectDefinition {
  id: SectId;
  name: string;
  raceIds: PlayerRaceId[];
  configVersion: number;
  methods: SectHeartMethodDefinition[];
  abilities: SectAbilityDefinition[];
  paths: SectPathDefinition[];
  tactics: SectTacticPreset[];
}

export interface SectMeridianLoadoutState {
  slot: 1 | 2 | 3;
  nodeIds: string[];
  version: number;
}

export interface CultivatorSectState {
  membershipId: string;
  sectId: SectId;
  status: SectMembershipStatus;
  experiencedAt?: string;
  joinedAt?: string;
  pathId?: SectPathId;
  contribution: number;
  tacticId: SectTacticId;
  activeMeridianSlot: 1 | 2 | 3;
  configVersion: number;
  methods: Partial<Record<LingxiaoMethodId, number>>;
  meridianLoadouts: SectMeridianLoadoutState[];
  abilityLoadout: SectAbilitySlots;
}

export interface SectMethodModifierProjection {
  methodId: LingxiaoMethodId;
  methodName: string;
  level: number;
  modifiers: AttributeModifierConfig[];
}

export interface CombatResourceDefinition {
  id: string;
  name: string;
  initial: number;
  max: number;
  decayOnNoDirectDamage?: number;
  decayOnControlledSkip?: number;
  pauseDecayWhileShielded?: boolean;
}

export interface SectCombatProjection {
  defaultAttack?: AbilityConfig;
  abilities: AbilityConfig[];
  methodModifiers: SectMethodModifierProjection[];
  resources: CombatResourceDefinition[];
  selectionStrategyId: SectSelectionStrategyId;
  tacticId: SectTacticId;
}
