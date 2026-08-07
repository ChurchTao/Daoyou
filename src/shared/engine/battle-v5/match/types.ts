import type {
  BattleActionIntentV1,
  BattlePlanningViewV1,
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from '../round/types';
import type { BattleSaveV1 } from '../persistence/types';
import type { TeamId, UnitId } from '../core/types';
import type { BattlePublicSnapshotV1 } from './BattlePublicSnapshot';

export type PlayerId = string;

export interface BattleControllerV1 {
  readonly playerId: PlayerId;
  readonly teamId: TeamId;
  readonly unitIds: readonly UnitId[];
}

export type BattleMatchStatusV1 =
  | 'waiting'
  | 'planning'
  | 'resolving'
  | 'finished'
  | 'cancelled';

export interface BattleMatchPlanningV1 {
  readonly round: number;
  readonly checkpointRevision: number;
  readonly deadlineAt: number;
  readonly submissions: Readonly<Record<UnitId, BattleActionIntentV1>>;
  readonly lockedPlayerIds: readonly PlayerId[];
}

export interface BattleMatchResolvingV1 {
  readonly commandSet: RoundCommandSetV1;
  readonly startedAt: number;
}

export interface BattleMatchStateV1 {
  readonly version: 'battle_match_state_v1';
  readonly matchId: string;
  readonly status: BattleMatchStatusV1;
  readonly revision: number;
  readonly processedRequestIds: readonly string[];
  readonly battle: BattleSaveV1;
  readonly controllers: readonly BattleControllerV1[];
  readonly planning?: BattleMatchPlanningV1;
  readonly resolving?: BattleMatchResolvingV1;
  readonly latestResolution?: BattleRoundResolutionV1;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateBattleMatchInput {
  readonly matchId: string;
  readonly battle: BattleSaveV1;
  readonly controllers: readonly BattleControllerV1[];
  readonly now: number;
  readonly planningTimeoutMs?: number;
}

export interface SubmitUnitIntentCommandV1 {
  readonly type: 'submit_unit_intent';
  readonly matchId: string;
  readonly requestId: string;
  readonly playerId: PlayerId;
  readonly expectedMatchRevision: number;
  readonly expectedCheckpointRevision: number;
  readonly unitId: UnitId;
  readonly intent: ClientBattleIntentV1;
}

export interface ClientBattleIntentV1 {
  readonly kind: 'ability' | 'pass';
  readonly abilityId?: string;
  readonly targetUnitId?: UnitId;
}

export interface LockPlayerCommandV1 {
  readonly type: 'lock_player';
  readonly matchId: string;
  readonly requestId: string;
  readonly playerId: PlayerId;
  readonly expectedMatchRevision: number;
  readonly expectedCheckpointRevision: number;
}

export interface ResolvePlanningTimeoutCommandV1 {
  readonly type: 'resolve_planning_timeout';
  readonly matchId: string;
  readonly requestId: string;
  readonly expectedMatchRevision: number;
  readonly expectedCheckpointRevision: number;
}

export type BattleMatchCommandV1 =
  | SubmitUnitIntentCommandV1
  | LockPlayerCommandV1
  | ResolvePlanningTimeoutCommandV1;

export interface ResolveRoundEffectV1 {
  readonly type: 'resolve_round';
  readonly commandSet: RoundCommandSetV1;
}

export type BattleMatchEffectV1 = ResolveRoundEffectV1;

export interface BattleMatchTransitionV1 {
  readonly state: BattleMatchStateV1;
  readonly effects: readonly BattleMatchEffectV1[];
  readonly changed: boolean;
  readonly duplicateRequest: boolean;
}

export interface BattleMatchPlayerViewV1 {
  readonly version: 'battle_match_player_view_v1';
  readonly matchId: string;
  readonly status: BattleMatchStatusV1;
  readonly revision: number;
  readonly playerId: PlayerId;
  readonly teamId: TeamId;
  readonly controlledUnitIds: readonly UnitId[];
  readonly round: number;
  readonly checkpointRevision: number;
  readonly deadlineAt?: number;
  readonly serverNow: number;
  readonly planningView?: BattlePlanningViewV1;
  readonly publicSnapshot: BattlePublicSnapshotV1;
  readonly latestResolution?: BattleRoundResolutionPublicV1;
  readonly ownSubmissions: Readonly<Record<UnitId, BattleActionIntentV1>>;
  readonly lockedPlayerIds: readonly PlayerId[];
}

export interface BattleRoundResolutionPublicV1 {
  readonly version: 'battle_round_resolution_public_v1';
  readonly commandSetId: string;
  readonly round: number;
  readonly outcome: BattleRoundResolutionV1['outcome'];
  readonly sequences: BattleRoundResolutionV1['sequences'];
  readonly stateTimeline: BattleRoundResolutionV1['stateTimeline'];
}
