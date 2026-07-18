import type {
  SectAbilityId,
  SectId,
  SectMethodId,
  SectNodeId,
  SectPathId,
  SectPathLayerId,
  SectTacticId,
} from './definitions';
import type { SectDiscipleRank, SectOffice } from './organization';

export type SectMembershipStatus = 'prospect' | 'active';
export type SectAbilitySlots = [
  SectAbilityId | null,
  SectAbilityId | null,
  SectAbilityId | null,
  SectAbilityId | null,
];

export interface SectMeridianLoadoutState {
  slot: 1 | 2 | 3;
  nodeIds: SectNodeId[];
  version: number;
}

export interface CultivatorSectPathState {
  pathId: SectPathId;
  unlockedLayerIds: SectPathLayerId[];
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
  discipleRank?: SectDiscipleRank;
  office?: SectOffice;
  promotedAt?: string;
  configVersion: number;
  methods: Partial<Record<SectMethodId, number>>;
  paths: CultivatorSectPathState[];
  abilityLoadout: SectAbilitySlots;
}
