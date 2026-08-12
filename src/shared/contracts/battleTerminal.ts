import { z } from 'zod';

const MatchIdSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);

export const BattleCleanupManifestSchema = z.object({
  version: z.literal('battle_cleanup_manifest_v1'),
  matchId: MatchIdSchema,
  kind: z.enum(['arena_sparring', 'standalone']),
  roomId: z.string().min(1).max(120).optional(),
  startRequestId: z.string().min(1).max(120).optional(),
  playerIds: z.array(z.string().min(1).max(160)).max(8),
  cultivatorIds: z.array(z.string().min(1).max(160)).max(8),
  createdAt: z.number().finite(),
}).strict();

export type BattleCleanupManifestV1 = z.infer<
  typeof BattleCleanupManifestSchema
>;

export const BattleTerminalEventSchema = z.object({
  version: z.literal('battle_terminal_event_v1'),
  eventId: z.string().min(1).max(300),
  matchId: MatchIdSchema,
  terminalStatus: z.enum(['finished', 'cancelled']),
  terminalReason: z.enum([
    'battle_completed',
    'technical_abort',
    'corrupt_runtime',
    'accept_timeout',
    'resolution_freeze_timeout',
  ]),
  stateRevision: z.number().int().nonnegative(),
  terminalAt: z.number().finite(),
}).strict();

export type BattleTerminalEventV1 = z.infer<typeof BattleTerminalEventSchema>;

export const BattleTerminalOutboxSchema = z.object({
  event: BattleTerminalEventSchema,
  manifest: BattleCleanupManifestSchema,
}).strict();

export type BattleTerminalOutboxV1 = z.infer<
  typeof BattleTerminalOutboxSchema
>;

export const BATTLE_TERMINAL_STREAM = 'DAOYOU_BATTLE_TERMINAL_V1';
export const BATTLE_TERMINAL_SUBJECT = 'daoyou.battle.lifecycle.terminal.v1';
