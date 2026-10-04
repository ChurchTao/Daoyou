import {
  CombatV6TerminalReasonSchema,
  VersionStampSchema,
} from '@daoyou/game-domain/combat';

import type { CombatV6BattleFinishedDataV1 } from '@daoyou/game-domain/combat/replay';

import {
  CombatV6TrainingBattleMetadataV1Schema,
  CombatV6BattleMetadataV1Schema,
  CombatV6ReplayTimelineSchema,
} from '@daoyou/game-domain/combat/replay';

import type { CombatV6VersionStamp } from '@daoyou/combat-core/types';

import type { CombatV6TrainingRuntimeSnapshotV1 } from '@daoyou/game-domain/combat';

import { z } from 'zod';


export const COMBAT_V6_RUNTIME_VERSION = 'combat_v6_redis_runtime_v1' as const;

export const COMBAT_V6_REPLAY_STREAM = 'DAOYOU_COMBAT_V6_REPLAY_ARCHIVES';

export const COMBAT_V6_REPLAY_SUBJECT = 'daoyou.combat-v6.replay.archive.v1';

export const CombatV6BattleFinishedRecordV1Schema = z
  .object({
    deadBeastIds: z.array(z.uuid()).max(6).optional(),
    battleId: z.uuid(),
    cultivatorId: z.uuid(),
    metadata: CombatV6BattleMetadataV1Schema,
    combatVersions: VersionStampSchema,
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    round: z.number().int().positive(),
    outcome: z.enum(['victory', 'defeat', 'draw', 'aborted']),
    reason: CombatV6TerminalReasonSchema,
    replayExpected: z.boolean(),
  })
  .strict();

export type CombatV6BattleFinishedRecordV1 = z.infer<
  typeof CombatV6BattleFinishedRecordV1Schema
>;

export interface CombatV6TerminalOutboxV1 {
  version: 'combat_v6_terminal_outbox_v1';
  event: {
    id: string;
    type: 'combat.v6.battle.finished';
    version: 1;
    subject: string;
    occurredAt: string;
    aggregate: { type: 'combat-v6-battle'; id: string };
    correlationId: string;
    data: CombatV6BattleFinishedDataV1;
  };
  record: CombatV6BattleFinishedRecordV1;
}

export interface CombatV6RedisRuntimeV1 {
  runtimeVersion: typeof COMBAT_V6_RUNTIME_VERSION;
  battleId: string;
  userId: string;
  cultivatorId: string;
  membershipId: string;
  metadata: z.infer<typeof CombatV6TrainingBattleMetadataV1Schema>;
  revision: number;
  createdAt: string;
  expiresAt: string;
  latestEventSeq: number;
  host: CombatV6TrainingRuntimeSnapshotV1;
}

export const CombatV6RedisRuntimeV1Schema = z
  .object({
    runtimeVersion: z.literal(COMBAT_V6_RUNTIME_VERSION),
    battleId: z.uuid(),
    userId: z.uuid(),
    cultivatorId: z.uuid(),
    membershipId: z.uuid(),
    metadata: CombatV6BattleMetadataV1Schema,
    revision: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    latestEventSeq: z.number().int().min(-1),
    host: z
      .object({
        schemaVersion: z.literal(1),
        hostVersion: z.literal('combat_v6_training_runtime_v1'),
        input: z
          .object({
            encounterId: z.string().min(1),
            tier: z.union([z.literal(60), z.literal(120), z.literal(180)]),
            seed: z.number().int(),
            player: z.record(z.string(), z.unknown()),
          })
          .passthrough(),
        state: z
          .object({
            round: z.number().int().positive(),
            rngState: z.number().int(),
          })
          .passthrough(),
        rounds: z.array(z.unknown()),
        events: z.array(z.unknown()),
        timeline: CombatV6ReplayTimelineSchema,
      })
      .strict(),
  })
  .strict();

export interface CombatV6ReplayArchiveMessageV1 {
  version: 'combat_v6_replay_archive_message_v1';
  battleId: string;
}

export const CombatV6ReplayArchiveMessageV1Schema = z
  .object({
    version: z.literal('combat_v6_replay_archive_message_v1'),
    battleId: z.uuid(),
  })
  .strict();

export function parseCombatV6Runtime(value: unknown): CombatV6RedisRuntimeV1 {
  return CombatV6RedisRuntimeV1Schema.parse(
    value,
  ) as unknown as CombatV6RedisRuntimeV1;
}

export type { CombatV6VersionStamp };
