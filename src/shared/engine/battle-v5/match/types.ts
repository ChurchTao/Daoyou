import type { BattleResolutionErrorCode } from '../core/BattleResolutionError';
import type { TeamId, UnitId } from '../core/types';
import type { BattleSaveV1 } from '../persistence/types';
import type {
  BattleActionIntentV1,
  BattlePlanningViewV1,
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from '../round/types';
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
  | 'presenting'
  | 'resolution_failed'
  | 'finished'
  | 'cancelled';

export interface BattleMatchPlanningV1 {
  readonly round: number;
  readonly checkpointRevision: number;
  readonly opensAt: number;
  readonly deadlineAt: number;
  readonly submissions: Readonly<Record<UnitId, BattleActionIntentV1>>;
  readonly committedPlayerIds: readonly PlayerId[];
}

export interface BattleMatchPresentationV1 {
  readonly resultId: string;
  readonly round: number;
  readonly startedAt: number;
  readonly readyAcceptedAt: number;
  readonly scheduledEndsAt: number;
  readonly readyPlayerIds: readonly PlayerId[];
}

export interface BattleMatchResolvingV1 {
  readonly commandSet: RoundCommandSetV1;
  readonly startedAt: number;
  readonly failure?: BattleResolutionFailureV1;
}

export interface BattleResolutionFailureV1 {
  readonly code: BattleResolutionErrorCode;
  readonly fingerprint: string;
  readonly message: string;
  readonly failedAt: number;
}

export type BattleResolutionFailurePublicV1 = Omit<
  BattleResolutionFailureV1,
  'message'
>;

export type BattleCommandReceiptStatusV1 =
  'accepted' | 'duplicate' | 'rejected';

export type BattleCommandRejectionReasonV1 =
  | 'deadline_reached'
  | 'already_committed'
  | 'stale_match'
  | 'stale_checkpoint'
  | 'invalid_intents'
  | 'match_not_planning';

export interface BattleCommandReceiptV1 {
  readonly requestId: string;
  readonly status: BattleCommandReceiptStatusV1;
  readonly reason?: BattleCommandRejectionReasonV1;
  readonly matchRevision: number;
  readonly checkpointRevision: number;
  readonly receivedAt: number;
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
  readonly presentation?: BattleMatchPresentationV1;
  readonly latestResolution?: BattleRoundResolutionPublicV1;
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

export interface CommitPlayerIntentsCommandV1 {
  readonly type: 'commit_player_intents';
  readonly matchId: string;
  readonly requestId: string;
  readonly playerId: PlayerId;
  readonly expectedMatchRevision: number;
  readonly expectedCheckpointRevision: number;
  readonly intents: Readonly<Record<UnitId, ClientBattleIntentV1>>;
}

export interface ClientBattleIntentV1 {
  readonly kind: 'ability' | 'basic_attack';
  readonly abilityId?: string;
  readonly targetUnitId?: UnitId;
}

export interface ResolvePlanningTimeoutCommandV1 {
  readonly type: 'resolve_planning_timeout';
  readonly matchId: string;
  readonly requestId: string;
  readonly expectedMatchRevision: number;
  readonly expectedCheckpointRevision: number;
}

export type BattleMatchCommandV1 =
  CommitPlayerIntentsCommandV1 | ResolvePlanningTimeoutCommandV1;

export interface BattleMatchTransitionV1 {
  readonly state: BattleMatchStateV1;
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
  readonly planningOpensAt?: number;
  readonly serverNow: number;
  readonly planningView?: BattlePlanningViewV1;
  readonly publicSnapshot: BattlePublicSnapshotV1;
  readonly latestResolution?: BattleRoundResolutionPublicV1;
  readonly presentation?: BattleMatchPresentationV1;
  readonly ownSubmissions: Readonly<Record<UnitId, BattleActionIntentV1>>;
  readonly ownCommitted: boolean;
  readonly commandReceipt?: BattleCommandReceiptV1;
  readonly resolutionFailure?: BattleResolutionFailurePublicV1;
}

export interface BattleRoundResolutionPublicV1 {
  readonly version: 'battle_round_resolution_public_v1';
  readonly commandSetId: string;
  readonly round: number;
  readonly outcome: BattleRoundResolutionV1['outcome'];
}
