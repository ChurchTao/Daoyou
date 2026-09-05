import type {
  CombatV6SectId,
  SectCombatProgressV6,
} from '@shared/engine/combat-v6/content';
import type {
  BattleEvent,
  CombatV6CommandOptions,
  CombatV6VersionStamp,
  Command,
} from '@shared/engine/combat-v6/core';
import type {
  CombatV6TrainingTierV1,
  TrainingEncounterOutcome,
} from '@shared/engine/combat-v6/encounter';
import type { DaoEquipmentLoadoutV1 } from '@shared/engine/combat-v6/equipment';
import type { CultivatorManualStateV1 } from '@shared/engine/combat-v6/manuals';
import { z } from 'zod';

export const COMBAT_V6_BUILD_SCHEMA_VERSION = 1 as const;
export const COMBAT_V6_TRAINING_API_VERSION = 1 as const;

export const CombatV6BuildInitializationStatusSchema = z.enum([
  'uninitialized',
  'pending',
  'active',
]);
export type CombatV6BuildInitializationStatus = z.infer<
  typeof CombatV6BuildInitializationStatusSchema
>;

export interface CombatV6BuildMethodViewV1 {
  id: string;
  name: string;
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  level: number;
  isPrimary: boolean;
}

export interface CombatV6BuildPathViewV1 {
  id: string;
  name: string;
}

export interface CombatV6BuildViewV1 {
  schemaVersion: typeof COMBAT_V6_BUILD_SCHEMA_VERSION;
  status: CombatV6BuildInitializationStatus;
  revision: number;
  membershipId?: string;
  sectId?: CombatV6SectId;
  sectName?: string;
  activePathId?: string;
  meridianDepth: number;
  methods: CombatV6BuildMethodViewV1[];
  paths: CombatV6BuildPathViewV1[];
  manuals?: CultivatorManualStateV1;
  equipment?: DaoEquipmentLoadoutV1;
}

export interface CombatV6PersistedBuildV1 {
  schemaVersion: typeof COMBAT_V6_BUILD_SCHEMA_VERSION;
  profileId: string;
  membershipId: string;
  cultivatorId: string;
  status: 'active';
  revision: number;
  sect: SectCombatProgressV6;
  manuals: CultivatorManualStateV1;
  equipment: DaoEquipmentLoadoutV1;
}

export const CombatV6BuildInitializeRequestSchema = z
  .object({
    activePathId: z.string().min(1).max(160),
    expectedRevision: z.literal(0),
  })
  .strict();
export type CombatV6BuildInitializeRequest = z.infer<
  typeof CombatV6BuildInitializeRequestSchema
>;

export const CombatV6TrainingTierSchema = z.union([
  z.literal(60),
  z.literal(120),
  z.literal(180),
]);

export const CombatV6TrainingCreateRequestSchema = z
  .object({
    encounterId: z.string().min(1).max(160),
    tier: CombatV6TrainingTierSchema,
  })
  .strict();
export type CombatV6TrainingCreateRequest = z.infer<
  typeof CombatV6TrainingCreateRequestSchema
>;

export const CombatV6TrainingCommandSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('attack'), target: z.string().min(1).max(200) })
    .strict(),
  z
    .object({
      type: z.literal('skill'),
      skillId: z.string().min(1).max(200),
      targets: z.array(z.string().min(1).max(200)).max(8),
    })
    .strict(),
  z.object({ type: z.literal('defend') }).strict(),
  z
    .object({ type: z.literal('protect'), target: z.string().min(1).max(200) })
    .strict(),
  z.object({ type: z.literal('flee') }).strict(),
]);
export type CombatV6TrainingCommandV1 = z.infer<
  typeof CombatV6TrainingCommandSchema
> &
  Command;

export const CombatV6TrainingCommandRequestSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    command: CombatV6TrainingCommandSchema,
  })
  .strict();

export const CombatV6TrainingRevisionRequestSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();

export const CombatV6TrainingSessionParamsSchema = z
  .object({ sessionId: z.string().uuid() })
  .strict();

export const CombatV6ReplayParamsSchema = z
  .object({ battleId: z.uuid() })
  .strict();

export const CombatV6TrainingCommandParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
    unitId: z.string().min(1).max(200),
  })
  .strict();

export const CombatV6TrainingEventsQuerySchema = z
  .object({
    afterEventSeq: z.coerce.number().int().min(-1).default(-1),
  })
  .strict();

export interface CombatV6TrainingUnitViewV1 {
  id: string;
  name: string;
  side: 0 | 1;
  slot: number;
  kind?: 'player' | 'pet' | 'npc';
  ownerId?: string;
  attributes?: Record<string, number>;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  wound: number;
  downed: boolean;
  dead: boolean;
  escaped: boolean;
  statuses: Array<{
    id: string;
    name?: string;
    remainingRounds: number;
    stacks: number;
  }>;
  barriers: Array<{
    id: string;
    name: string;
    current: number;
    remainingRounds: number;
  }>;
  resources: Array<{ id: string; name: string; current: number; max: number }>;
}

export type CombatV6UnitChanges = Partial<
  Omit<CombatV6TrainingUnitViewV1, 'id'>
>;
export type CombatV6OptionalUnitField = 'kind' | 'ownerId' | 'attributes';
export interface CombatV6DeltaFrameV1 {
  afterEventSeq: number;
  round: number;
  updates: Array<{
    id: string;
    set: CombatV6UnitChanges;
    unset?: CombatV6OptionalUnitField[];
  }>;
  added?: CombatV6TrainingUnitViewV1[];
  removed?: string[];
  /** Present only when insertion/reordering cannot preserve the existing array order. */
  order?: string[];
}
export interface CombatV6PlaybackV1 {
  format: 'delta-v1';
  fromEventSeq: number;
  frames: CombatV6DeltaFrameV1[];
}

export interface CombatV6TrainingSessionViewV1 {
  apiVersion: typeof COMBAT_V6_TRAINING_API_VERSION;
  sessionId: string;
  revision: number;
  expiresAt: string;
  encounterId: string;
  tier: CombatV6TrainingTierV1;
  combatVersions: CombatV6VersionStamp;
  round: number;
  phase: string;
  outcome?: TrainingEncounterOutcome;
  units: CombatV6TrainingUnitViewV1[];
  commandOptions?: CombatV6CommandOptions;
  pendingCommand?: CombatV6TrainingCommandV1;
  events: Array<{ seq: number; event: BattleEvent }>;
  latestEventSeq: number;
  display?: {
    skills: Record<string, string>;
    skillDetails?: Record<
      string,
      { category: 'spell' | 'art'; description: string }
    >;
    statuses: Record<string, string>;
  };
  /** Ephemeral public display deltas; requires a matching event cursor. */
  playback?: CombatV6PlaybackV1;
}

export const COMBAT_V6_BUILD_ERROR_CODE = {
  NotInitialized: 'COMBAT_V6_BUILD_NOT_INITIALIZED',
  Pending: 'COMBAT_V6_BUILD_PENDING',
  RevisionConflict: 'COMBAT_V6_BUILD_REVISION_CONFLICT',
  Invalid: 'COMBAT_V6_BUILD_INVALID',
  SectUnsupported: 'COMBAT_V6_SECT_UNSUPPORTED',
  MembershipRequired: 'COMBAT_V6_ACTIVE_MEMBERSHIP_REQUIRED',
  PathInvalid: 'COMBAT_V6_PATH_INVALID',
  ProjectionFailed: 'COMBAT_V6_PLAYER_PROJECTION_FAILED',
} as const;

export const COMBAT_V6_TRAINING_ERROR_CODE = {
  AlreadyActive: 'TRAINING_SESSION_ALREADY_ACTIVE',
  NotFound: 'TRAINING_SESSION_NOT_FOUND',
  RevisionConflict: 'TRAINING_SESSION_REVISION_CONFLICT',
  MembershipChanged: 'TRAINING_SESSION_MEMBERSHIP_CHANGED',
  CommandInvalid: 'TRAINING_COMMAND_INVALID',
  CommandNotAllowed: 'TRAINING_COMMAND_NOT_ALLOWED',
  RoundNotReady: 'TRAINING_ROUND_NOT_READY',
} as const;

export const COMBAT_V6_REPLAY_ERROR_CODE = {
  Pending: 'COMBAT_V6_REPLAY_PENDING',
  NotFound: 'COMBAT_V6_REPLAY_NOT_FOUND',
} as const;
