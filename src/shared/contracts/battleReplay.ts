import { z } from 'zod';
import type { BattlePublicSnapshotV1 } from '../engine/battle-v5/match/BattlePublicSnapshot';
import type { BattleControllerV1 } from '../engine/battle-v5/match/types';
import type { BattleSaveV1 } from '../engine/battle-v5/persistence/types';
import type {
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from '../engine/battle-v5/round/types';
import type { TeamVictoryResult } from '../engine/battle-v5/systems/TeamVictorySystem';

export const BATTLE_REPLAY_STREAM = 'DAOYOU_BATTLE_REPLAY_ARCHIVES';
export const BATTLE_REPLAY_SUBJECT = 'daoyou.battle.replay.archive.v1';
export const BATTLE_REPLAY_ROUND_MAX_SERIALIZED_BYTES = 512 * 1024;

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

export interface BattleReplayArchiveJobV3 {
  readonly version: 'battle_replay_archive_job_v3';
  readonly subject: typeof BATTLE_REPLAY_SUBJECT;
  readonly matchId: string;
  readonly expectedStorageRevision: number;
  readonly attempt: number;
}

const VersionedObjectSchema = z
  .object({ version: z.string().min(1) })
  .passthrough();

const BattleReplaySchema = z
  .object({
    version: z.literal('battle_replay_v1'),
    matchId: z.string().min(1).max(120),
    engineVersion: z.literal('battle-v5'),
    rulesetVersion: z.literal('team-sync-round-v1'),
    startedAt: z.number().finite().nonnegative(),
    finishedAt: z.number().finite().nonnegative(),
    participants: z
      .array(
        z
          .object({
            playerId: z.string().min(1).max(120),
            teamId: z.string().min(1).max(32),
            unitIds: z.array(z.string().min(1).max(120)).min(1).max(4),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    initialBattle: VersionedObjectSchema.refine(
      (value) => value.version === 'battle_save_v1',
      'Invalid initial battle save version',
    ),
    rounds: z
      .array(
        z
          .object({
            round: z.number().int().positive(),
            commandSet: VersionedObjectSchema.refine(
              (value) => value.version === 'round_command_set_v1',
              'Invalid round command set version',
            ),
            resolution: VersionedObjectSchema.refine(
              (value) => value.version === 'battle_replay_round_resolution_v1',
              'Invalid replay resolution version',
            ),
          })
          .strict(),
      )
      .min(1),
    finalSnapshot: VersionedObjectSchema.refine(
      (value) => value.version === 'battle_public_snapshot_v1',
      'Invalid final battle snapshot version',
    ),
    outcome: z.object({ battleEnded: z.boolean() }).passthrough(),
  })
  .strict()
  .superRefine((replay, context) => {
    if (replay.finishedAt < replay.startedAt) {
      context.addIssue({
        code: 'custom',
        path: ['finishedAt'],
        message: 'Battle replay finish time precedes start time',
      });
    }
    if (!replay.outcome.battleEnded) {
      context.addIssue({
        code: 'custom',
        path: ['outcome', 'battleEnded'],
        message: 'Archived battle replay must be finished',
      });
    }
  });

const BattleReplayArchiveJobSchema = z
  .object({
    version: z.literal('battle_replay_archive_job_v3'),
    subject: z.literal(BATTLE_REPLAY_SUBJECT),
    matchId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    expectedStorageRevision: z.number().int().nonnegative(),
    attempt: z.number().int().positive().max(1_000_000),
  })
  .strict();

export function parseBattleReplay(input: unknown): BattleReplayV1 {
  return BattleReplaySchema.parse(input) as unknown as BattleReplayV1;
}

export function parseBattleReplayArchiveJob(
  input: unknown,
): BattleReplayArchiveJobV3 {
  return BattleReplayArchiveJobSchema.parse(input) as BattleReplayArchiveJobV3;
}
