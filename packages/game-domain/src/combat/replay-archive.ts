import { z } from 'zod';
import type {
  BattleEvent,
  BattleState,
  CombatV6VersionStamp,
  Command,
  LineupUnit,
  SkillDef,
  StatusDef,
} from '@daoyou/combat-core/types';
import { CombatV6BattleMetadataV1Schema } from './metadata.js';
import type { CombatV6ReplayTimeline } from './replay.js';
import { CombatV6ReplayTimelineSchema } from './replay-schema.js';
import type { CombatV6DisplayCatalog } from './display.js';
import {
  CombatV6TerminalReasonSchema,
  VersionStampSchema,
  type CombatV6TerminalReason,
} from './runtime-values.js';

export const COMBAT_V6_REPLAY_VERSION = 'combat_v6_replay_v2' as const;

export const CombatV6ReplayMetadataSchema = z.union([
  z
    .object({
      schemaVersion: z.literal(1),
      sourceType: z.literal('hunt'),
      battleType: z.literal('pve'),
      idempotencyKey: z.uuid(),
      payload: z.object({ eventId: z.string(), roomId: z.uuid() }).strict(),
    })
    .strict(),
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
  timeline: CombatV6ReplayTimeline;
  display: CombatV6DisplayCatalog;
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
  replayVersion: typeof COMBAT_V6_REPLAY_VERSION;
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
    replayVersion: z.literal(COMBAT_V6_REPLAY_VERSION),
    timeline: CombatV6ReplayTimelineSchema,
    display: z.object({
      skills: z.record(z.string(), z.string()),
      statuses: z.record(z.string(), z.string()),
      skillDetails: z.record(z.string(), z.unknown()).optional(),
    }),
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
    (value) => !!value.timeline.finalUnits,
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

export function parseCombatV6Replay(value: unknown): CombatV6ReplayV1 {
  return CombatV6ReplayV1Schema.parse(value) as unknown as CombatV6ReplayV1;
}
