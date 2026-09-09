// Historical PostgreSQL JSON shape only. The V5 online replay runtime is retired.
import type { BattlePublicSnapshotV1 } from '../engine/battle-v5/match/BattlePublicSnapshot';
import type { BattleControllerV1 } from '../engine/battle-v5/match/types';
import type { BattleSaveV1 } from '../engine/battle-v5/persistence/types';
import type {
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from '../engine/battle-v5/round/types';
import type { TeamVictoryResult } from '../engine/battle-v5/systems/TeamVictorySystem';


/** Full round material for durable replay only; never expose this through playerView. */
export interface BattleReplayRoundResolutionV1 {
  readonly version: 'battle_replay_round_resolution_v1';
  readonly commandSetId: string;
  readonly round: number;
  readonly outcome: BattleRoundResolutionV1['outcome'];
  readonly sequences: BattleRoundResolutionV1['sequences'];
  readonly stateTimeline: BattleRoundResolutionV1['stateTimeline'];
}

export interface BattleReplayRoundV1 {
  readonly round: number;
  readonly commandSet: RoundCommandSetV1;
  readonly resolution: BattleReplayRoundResolutionV1;
}

export interface BattleReplayV1 {
  readonly version: 'battle_replay_v1';
  readonly matchId: string;
  readonly engineVersion: 'battle-v5';
  readonly rulesetVersion: 'team-sync-round-v1';
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly participants: readonly BattleControllerV1[];
  readonly initialBattle: BattleSaveV1;
  readonly rounds: readonly BattleReplayRoundV1[];
  readonly finalSnapshot: BattlePublicSnapshotV1;
  readonly outcome: TeamVictoryResult;
}
