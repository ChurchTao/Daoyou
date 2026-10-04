import type {
  ArenaState,
  ArenaSnapshot,
} from '@daoyou/game-domain/combat/arena';
import { COMBAT_V6_TRAINING_API_VERSION } from './combatV6.js';
import { z } from 'zod';
import { CombatV6CommandGroupSchema } from '@daoyou/game-domain/combat';

export const ARENA_V6_PROTOCOL = 'combat_v6_arena_v1' as const;

export const ArenaV6SubmitSchema = z
  .object({
    round: z.number().int().positive(),
    requestId: z.uuid(),
    commands: z.union([CombatV6CommandGroupSchema, z.literal('AUTO')]),
  })
  .strict();
export type ArenaV6Submit = z.infer<typeof ArenaV6SubmitSchema>;

export type ArenaRuntime = ArenaState<ArenaSessionView> & {
  protocol: typeof ARENA_V6_PROTOCOL;
};
export type ArenaSessionView = ArenaSnapshot & {
  apiVersion: typeof COMBAT_V6_TRAINING_API_VERSION;
  protocol: typeof ARENA_V6_PROTOCOL;
};
export type ArenaSocketMessage =
  | { type: 'ready' | 'ping'; serverNow: number }
  | { type: 'state'; session: ArenaSessionView }
  | { type: 'resync'; revision: number };
