import type { AbilityConfig, AttributeModifierConfig } from '@shared/engine/battle-v5/core/configs';
import type { RealmStage, RealmType } from '@shared/types/constants';

export type PlayerRaceId = 'human';
export type SectId = 'lingxiao';
export type SectPathId = 'swift-sword';
export type SectMembershipStatus = 'prospect' | 'active';
export type SectTacticId = 'aggressive' | 'steady' | 'counter';

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
  abilityLoadout: LingxiaoAbilityId[];
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
  passiveModifiers: AttributeModifierConfig[];
  resources: CombatResourceDefinition[];
  tacticId: SectTacticId;
}
