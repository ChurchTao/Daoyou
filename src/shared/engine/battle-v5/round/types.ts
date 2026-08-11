import type { TeamId, UnitId } from '../core/types';
import type { BattleCheckpointV1, BattleSaveV1 } from '../persistence/types';
import type { CombatVisualSpec } from '../presentation/CombatVisualProtocol';
import type { TeamVictoryResult } from '../systems/TeamVictorySystem';
import type { BattleStateTimelineV3, CombatSequenceV3 } from '../v3/types';

export const ROUND_PLANNING_TIMEOUT_MS = 30_000;

export type BattleActionIntentV1 =
  | {
      kind: 'ability';
      abilityId: string;
      targetUnitId?: UnitId;
      submittedBy: 'player' | 'timeout';
    }
  | {
      kind: 'basic_attack';
      targetUnitId: UnitId;
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
  /** Safe presentation metadata; battle rules never consume these fields. */
  description?: string;
  visual?: CombatVisualSpec;
  costs?: ReadonlyArray<{
    resource: 'mp' | 'hp';
    amount: number;
    mode?: string;
  }>;
  cooldown?: { current: number; max: number };
  ready: boolean;
  unavailableReason?:
    'cooldown' | 'resource' | 'no_target' | 'condition' | 'unknown';
  targetTeam: 'enemy' | 'ally' | 'self' | 'any';
  targetScope: 'single' | 'aoe' | 'random';
  legalTargetIds: UnitId[];
}

export interface PlanningUnitViewV1 {
  unitId: UnitId;
  teamId: TeamId;
  alive: boolean;
  basicAttack?: PlanningBasicAttackViewV1;
  forcedAction?: PlanningForcedActionViewV1;
  abilities: PlanningAbilityViewV1[];
}

export interface PlanningBasicAttackViewV1 {
  abilityId: 'basic_attack';
  name: string;
  ready: boolean;
  unavailableReason?: 'no_target' | 'condition';
  legalTargetIds: UnitId[];
}

export interface PlanningForcedActionViewV1 {
  kind: 'queued_action_target';
  abilityId: string;
  abilityName: string;
  legalTargetIds: UnitId[];
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
}
