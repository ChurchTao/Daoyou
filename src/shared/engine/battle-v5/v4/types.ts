import type { TeamId, TeamSlot, UnitId } from '../core/types';
import type { UnitStateSnapshot } from '../systems/state/types';
import type {
  BattleStateTimelineV3,
  CombatSequenceV3,
  UnitRefV3,
} from '../v3/types';

export interface BattleRecordTeamV4 {
  id: TeamId;
  units: Array<UnitRefV3 & { slot: TeamSlot }>;
}

export type BattleOutcomeV4 =
  | {
      result: 'victory';
      winnerTeamId: TeamId;
      loserTeamId: TeamId;
      rounds: number;
      reason: 'elimination' | 'round_limit';
    }
  | {
      result: 'draw';
      rounds: number;
    };

export interface BattleRecordV4 {
  version: 'battle_record_v4';
  teams: [BattleRecordTeamV4, BattleRecordTeamV4];
  outcome: BattleOutcomeV4;
  sequences: CombatSequenceV3[];
  stateTimeline: BattleStateTimelineV3;
  finalSnapshots: Record<UnitId, UnitStateSnapshot>;
}
