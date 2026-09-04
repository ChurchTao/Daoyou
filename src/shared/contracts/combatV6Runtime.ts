import type { CombatV6VersionStamp } from '@shared/engine/combat-v6/core';
import type {
  CombatV6EncounterTraceV1,
  CombatV6TrainingRuntimeSnapshotV1,
  TrainingEncounterOutcome,
} from '@shared/engine/combat-v6/encounter';
import { z } from 'zod';

export const COMBAT_V6_RUNTIME_VERSION = 'combat_v6_redis_runtime_v1' as const;
export const COMBAT_V6_REPLAY_VERSION = 'combat_v6_replay_v1' as const;
export const COMBAT_V6_REPLAY_STREAM = 'DAOYOU_COMBAT_V6_REPLAY_ARCHIVES';
export const COMBAT_V6_REPLAY_SUBJECT = 'daoyou.combat-v6.replay.archive.v1';

export const CombatV6TrainingBattleMetadataV1Schema = z.object({
  schemaVersion: z.literal(1),
  sourceType: z.literal('training-room'),
  battleType: z.literal('training'),
  idempotencyKey: z.uuid(),
  payload: z.object({
    encounterId: z.string().min(1).max(160),
    tier: z.union([z.literal(60), z.literal(120), z.literal(180)]),
  }).strict(),
}).strict();

export const CombatV6BattleMetadataV1Schema = z.discriminatedUnion('sourceType', [
  CombatV6TrainingBattleMetadataV1Schema,
]);
export type CombatV6BattleMetadataV1 = z.infer<typeof CombatV6BattleMetadataV1Schema>;

export const CombatV6TerminalReasonSchema = z.enum([
  'battle-ended',
  'fled',
  'player-abandoned',
  'expired',
  'membership-changed',
  'technical-abort',
]);
export type CombatV6TerminalReason = z.infer<typeof CombatV6TerminalReasonSchema>;

const VersionStampSchema = z.object({
  engineVersion: z.string().min(1),
  rulesetVersion: z.string().min(1),
  contentVersion: z.string().min(1),
  projectionVersion: z.string().min(1),
}).strict();

export const CombatV6BattleFinishedRecordV1Schema = z.object({
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
}).strict();
export type CombatV6BattleFinishedRecordV1 = z.infer<typeof CombatV6BattleFinishedRecordV1Schema>;

/** JetStream中只发送指针；完整终局记录由消费者按battleId从Redis读取。 */
export const CombatV6BattleFinishedDataV1Schema = z.object({ battleId: z.uuid() }).strict();
export type CombatV6BattleFinishedDataV1 = z.infer<typeof CombatV6BattleFinishedDataV1Schema>;

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
  buildRevision: number;
  metadata: CombatV6BattleMetadataV1;
  revision: number;
  createdAt: string;
  expiresAt: string;
  latestEventSeq: number;
  host: CombatV6TrainingRuntimeSnapshotV1;
}

export const CombatV6RedisRuntimeV1Schema = z.object({
  runtimeVersion: z.literal(COMBAT_V6_RUNTIME_VERSION),
  battleId: z.uuid(),
  userId: z.uuid(),
  cultivatorId: z.uuid(),
  membershipId: z.uuid(),
  buildRevision: z.number().int().nonnegative(),
  metadata: CombatV6BattleMetadataV1Schema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  latestEventSeq: z.number().int().min(-1),
  host: z.object({
    schemaVersion: z.literal(1),
    hostVersion: z.literal('combat_v6_training_runtime_v1'),
    input: z.object({
      encounterId: z.string().min(1),
      tier: z.union([z.literal(60), z.literal(120), z.literal(180)]),
      seed: z.number().int(),
      player: z.record(z.string(), z.unknown()),
    }).passthrough(),
    state: z.object({ round: z.number().int().positive(), rngState: z.number().int() }).passthrough(),
    rounds: z.array(z.unknown()),
    events: z.array(z.unknown()),
  }).strict(),
}).strict();

export interface CombatV6ReplayV1 extends CombatV6EncounterTraceV1 {
  replayVersion: typeof COMBAT_V6_REPLAY_VERSION;
  battleId: string;
  cultivatorId: string;
  metadata: CombatV6BattleMetadataV1;
  startedAt: string;
  finishedAt: string;
  finalState: NonNullable<CombatV6EncounterTraceV1['finalState']>;
  outcome: TrainingEncounterOutcome;
}

export const CombatV6ReplayV1Schema = z.object({
  replayVersion: z.literal(COMBAT_V6_REPLAY_VERSION),
  battleId: z.uuid(),
  cultivatorId: z.uuid(),
  metadata: CombatV6BattleMetadataV1Schema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  schemaVersion: z.literal(1),
  hostVersion: z.literal('combat_v6_encounter_host_v1'),
  encounterId: z.string().min(1),
  tier: z.union([z.literal(60), z.literal(120), z.literal(180)]),
  seed: z.number().int(),
  combatVersions: VersionStampSchema,
  sourceProjectionVersions: VersionStampSchema,
  initialUnits: z.array(z.unknown()).min(1),
  skills: z.array(z.unknown()),
  statusDefs: z.array(z.unknown()),
  rounds: z.array(z.unknown()),
  events: z.array(z.unknown()),
  finalState: z.object({ round: z.number().int().positive() }).passthrough(),
  outcome: z.enum(['victory', 'defeat', 'draw', 'aborted']),
}).strict();

export interface CombatV6ReplayArchiveMessageV1 {
  version: 'combat_v6_replay_archive_message_v1';
  battleId: string;
}

export const CombatV6ReplayArchiveMessageV1Schema = z.object({
  version: z.literal('combat_v6_replay_archive_message_v1'),
  battleId: z.uuid(),
}).strict();

export function parseCombatV6Runtime(value: unknown): CombatV6RedisRuntimeV1 {
  return CombatV6RedisRuntimeV1Schema.parse(value) as unknown as CombatV6RedisRuntimeV1;
}

export function parseCombatV6Replay(value: unknown): CombatV6ReplayV1 {
  return CombatV6ReplayV1Schema.parse(value) as unknown as CombatV6ReplayV1;
}

export type { CombatV6VersionStamp };
