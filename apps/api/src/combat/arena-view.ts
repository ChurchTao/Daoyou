import { COMBAT_V6_TRAINING_API_VERSION } from '@daoyou/contracts/combat';
import {
  ARENA_V6_PROTOCOL,
  type ArenaRuntime,
  type ArenaSessionView,
} from '@daoyou/contracts/combat/arena';
import {
  arenaView as projectArenaView,
  resolveArena as resolveArenaRound,
} from '@daoyou/game-rules/combat/arena';
export function arenaView(
  runtime: ArenaRuntime,
  viewerId: string,
  now: number,
): ArenaSessionView {
  return {
    apiVersion: COMBAT_V6_TRAINING_API_VERSION,
    protocol: ARENA_V6_PROTOCOL,
    ...projectArenaView(runtime, viewerId, now),
  };
}
export function resolveArena(runtime: ArenaRuntime, now: number): ArenaRuntime {
  return resolveArenaRound(runtime, now, arenaView);
}
