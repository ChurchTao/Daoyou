import type { TeamId, UnitId } from '../core/types';
import type { BattleCheckpointV1, BattleSaveV1 } from '../persistence/types';
import type { BattleStateTimelineV3, CombatSequenceV3 } from '../v3/types';
import type { TeamVictoryResult } from '../systems/TeamVictorySystem';

export const ROUND_PLANNING_TIMEOUT_MS = 30_000;

export type BattleActionIntentV1 =
  | {
      kind: 'ability';
      abilityId: string;
      targetUnitId?: UnitId;
      submittedBy: 'player' | 'timeout';
    }
  | {
      kind: 'pass';
      submittedBy: 'player' | 'timeout';
    };

export interface RoundCommandSetV1 {
  version: 'round_command_set_v1';
  commandSetId: string;
  round: number;
  checkpointRevision: number;
  intents: Record<UnitId, BattleActionIntentV1>;
}

export interface PlanningAbilityViewV1 {
  abilityId: string;
  name: string;
  ready: boolean;
  targetTeam: 'enemy' | 'ally' | 'self' | 'any';
  targetScope: 'single' | 'aoe' | 'random';
  legalTargetIds: UnitId[];
}

export interface PlanningUnitViewV1 {
  unitId: UnitId;
  teamId: TeamId;
  alive: boolean;
  abilities: PlanningAbilityViewV1[];
}

export interface BattlePlanningViewV1 {
  version: 'battle_planning_view_v1';
  round: number;
  checkpointRevision: number;
  units: PlanningUnitViewV1[];
}

export interface BattleRoundResolutionV1 {
  version: 'battle_round_resolution_v1';
  commandSetId: string;
  round: number;
  outcome: TeamVictoryResult;
  sequences: CombatSequenceV3[];
  stateTimeline: BattleStateTimelineV3;
  checkpoint: BattleCheckpointV1;
  save: BattleSaveV1;
  nextPlanningView?: BattlePlanningViewV1;
}
