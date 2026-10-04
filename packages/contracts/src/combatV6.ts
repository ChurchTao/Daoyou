import type {
  CombatV6SessionSnapshot,
  CombatV6TrainingTierV1,
} from '@daoyou/game-domain/combat';
import { CombatV6CommandGroupSchema } from '@daoyou/game-domain/combat';


import { z } from 'zod';

export const COMBAT_V6_TRAINING_API_VERSION = 1 as const;

export const SectPathSelectionRequestSchema = z
  .object({
    activePathId: z.string().min(1).max(160),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type SectPathSelectionRequest = z.infer<
  typeof SectPathSelectionRequestSchema
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

export const CombatV6TrainingCommandRequestSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    commands: CombatV6CommandGroupSchema,
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

export interface CombatV6TrainingSessionViewV1 extends CombatV6SessionSnapshot {
  apiVersion: typeof COMBAT_V6_TRAINING_API_VERSION;
  encounterId: string;
  tier: CombatV6TrainingTierV1;
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
