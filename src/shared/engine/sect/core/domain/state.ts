import type { SectId } from './definitions';
import type { SectDiscipleRank, SectOffice } from './organization';

export type SectMembershipStatus = 'prospect' | 'active' | 'transferred';
export interface CultivatorSectState {
  membershipId: string;
  sectId: SectId;
  status: SectMembershipStatus;
  joinedAt?: string;
  contribution: number;
  /** Total contribution earned; unlike contribution, this is not reduced by spending. */
  lifetimeContribution?: number;
  discipleRank?: SectDiscipleRank;
  office?: SectOffice;
  promotedAt?: string;
  configVersion: number;
}
