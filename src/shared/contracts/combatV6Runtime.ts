import type {
  BattleEvent,
  BattleState,
  CombatV6VersionStamp,
  Command,
  LineupUnit,
  SkillDef,
  StatusDef,
} from '@shared/engine/combat-v6/core';
import type { CombatV6TrainingRuntimeSnapshotV1 } from '@shared/engine/combat-v6/encounter';
import { z } from 'zod';
import {
  CombatV6ReplayTimelineSchema,
  type CombatV6ReplayDisplay,
  type CombatV6ReplayTimeline,
} from './combatV6Replay';

export const COMBAT_V6_RUNTIME_VERSION = 'combat_v6_redis_runtime_v1' as const;
export const COMBAT_V6_REPLAY_VERSION = 'combat_v6_replay_v2' as const;
export const COMBAT_V6_REPLAY_STREAM = 'DAOYOU_COMBAT_V6_REPLAY_ARCHIVES';
export const COMBAT_V6_REPLAY_SUBJECT = 'daoyou.combat-v6.replay.archive.v1';

export const CombatV6TrainingBattleMetadataV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.literal('training-room'),
    battleType: z.literal('training'),
    idempotencyKey: z.uuid(),
    payload: z
      .object({
        encounterId: z.string().min(1).max(160),
        tier: z.union([z.literal(60), z.literal(120), z.literal(180)]),
      })
      .strict(),
  })
  .strict();

export const CombatV6BattleMetadataV1Schema = z.discriminatedUnion(
  'sourceType',
  [
    CombatV6TrainingBattleMetadataV1Schema,
    z.object({
      schemaVersion: z.literal(1),
      sourceType: z.literal('sect-task'),
      battleType: z.literal('pve'),
      idempotencyKey: z.uuid(),
      payload: z.object({ recordId: z.uuid(), taskId: z.string().min(1) }).strict(),
    }).strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('ranking'),
        battleType: z.literal('pvp'),
        idempotencyKey: z.uuid(),
        payload: z.object({ realm: z.string(), day: z.string() }).strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('tower'),
        battleType: z.literal('pve'),
        idempotencyKey: z.uuid(),
        payload: z
          .object({ runId: z.uuid(), floor: z.number().int().min(1).max(20) })
          .strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('dungeon'),
        battleType: z.literal('pve'),
        idempotencyKey: z.uuid(),
        payload: z
          .object({ runId: z.uuid(), nodeId: z.string().min(1) })
          .strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('wild-encounter'),
        battleType: z.literal('pve'),
        idempotencyKey: z.string().min(1).max(200),
        payload: z
          .object({
            nodeId: z.string().min(1),
            encounterContentVersion: z.string().min(1),
            combatants: z
              .array(
                z
                  .object({
                    unitId: z.string().min(1),
                    speciesId: z.string().min(1),
                    level: z.number().int().min(5).max(15),
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      })
      .strict(),
  ],
);
export type CombatV6BattleMetadataV1 = z.infer<
  typeof CombatV6BattleMetadataV1Schema
>;

export const CombatV6TerminalReasonSchema = z.enum([
  'battle-ended',
  'fled',
  'player-abandoned',
  'expired',
  'membership-changed',
  'technical-abort',
]);
export type CombatV6TerminalReason = z.infer<
  typeof CombatV6TerminalReasonSchema
>;

const VersionStampSchema = z
  .object({
    engineVersion: z.string().min(1),
    rulesetVersion: z.string().min(1),
    contentVersion: z.string().min(1),
    projectionVersion: z.string().min(1),
  })
  .strict();

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

/** JetStream中只发送指针；完整终局记录由消费者按battleId从Redis读取。 */
export const CombatV6BattleFinishedDataV1Schema = z
  .object({
    battleId: z.uuid(),
    sourceType: z.literal('arena-sparring').optional(),
  })
  .strict();
export type CombatV6BattleFinishedDataV1 = z.infer<
  typeof CombatV6BattleFinishedDataV1Schema
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
  buildRevision: number;
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
    buildRevision: z.number().int().nonnegative(),
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
        timeline: CombatV6ReplayTimelineSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const CombatV6ReplayMetadataSchema = z.union([
  CombatV6BattleMetadataV1Schema,
  z
    .object({
      schemaVersion: z.literal(1),
      sourceType: z.literal('arena-sparring'),
      battleType: z.literal('pvp'),
      idempotencyKey: z.uuid(),
      payload: z.object({ roomId: z.string().min(1) }).strict(),
    })
    .strict(),
]);

export const CombatV6ReplayParticipantSchema = z
  .object({
    userId: z.string().min(1),
    cultivatorId: z.uuid(),
    unitId: z.string().min(1),
    side: z.union([z.literal(0), z.literal(1)]),
    slot: z.number().int().nonnegative(),
  })
  .strict();

export interface CombatV6ReplayV1 {
  timeline?: CombatV6ReplayTimeline;
  display?: CombatV6ReplayDisplay;
  seed: number;
  combatVersions: CombatV6VersionStamp;
  initialUnits: LineupUnit[];
  skills: SkillDef[];
  statusDefs: StatusDef[];
  rounds: Array<{
    round: number;
    commands: Array<{ unitId: string; command: Command }>;
  }>;
  events: BattleEvent[];
  replayVersion: 'combat_v6_replay_v1' | typeof COMBAT_V6_REPLAY_VERSION;
  battleId: string;
  participants: z.infer<typeof CombatV6ReplayParticipantSchema>[];
  metadata: z.infer<typeof CombatV6ReplayMetadataSchema>;
  startedAt: string;
  finishedAt: string;
  finalState: BattleState;
  outcome: 'side-0' | 'side-1' | 'draw' | 'aborted';
  reason: CombatV6TerminalReason;
}

export const CombatV6ReplayV1Schema = z
  .object({
    replayVersion: z.enum(['combat_v6_replay_v1', COMBAT_V6_REPLAY_VERSION]),
    timeline: CombatV6ReplayTimelineSchema.optional(),
    display: z
      .object({
        skills: z.record(z.string(), z.string()),
        statuses: z.record(z.string(), z.string()),
        skillDetails: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    battleId: z.uuid(),
    participants: z.array(CombatV6ReplayParticipantSchema).min(1).max(8),
    metadata: CombatV6ReplayMetadataSchema,
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    seed: z.number().int(),
    combatVersions: VersionStampSchema,
    initialUnits: z.array(z.unknown()).min(1),
    skills: z.array(z.unknown()),
    statusDefs: z.array(z.unknown()),
    rounds: z.array(z.unknown()),
    events: z.array(z.unknown()),
    finalState: z.object({ round: z.number().int().positive() }).passthrough(),
    outcome: z.enum(['side-0', 'side-1', 'draw', 'aborted']),
    reason: CombatV6TerminalReasonSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.replayVersion !== COMBAT_V6_REPLAY_VERSION ||
      (!!value.timeline?.finalUnits && !!value.display),
    'Playable replay requires frozen presentation',
  )
  .refine(
    (value) =>
      new Set(value.participants.map((p) => p.cultivatorId)).size ===
        value.participants.length &&
      new Set(value.participants.map((p) => p.unitId)).size ===
        value.participants.length,
    'Replay participants must be unique',
  );

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

export function parseCombatV6Replay(value: unknown): CombatV6ReplayV1 {
  return CombatV6ReplayV1Schema.parse(value) as unknown as CombatV6ReplayV1;
}

export type { CombatV6VersionStamp };
