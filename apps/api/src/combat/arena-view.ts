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
import type { ArenaViewSource } from './application/CombatV6ArenaStore.js';
export function arenaView(
  runtime: ArenaRuntime,
  viewerId: string,
  now: number,
  afterEventSeq?: number,
): ArenaSessionView {
  return {
    apiVersion: COMBAT_V6_TRAINING_API_VERSION,
    protocol: ARENA_V6_PROTOCOL,
    ...projectArenaView(runtime, viewerId, now, afterEventSeq),
  };
}

export function arenaDeliveryView(
  runtime: ArenaViewSource,
  viewerId: string,
  now: number,
): ArenaSessionView {
  if ('state' in runtime) return arenaView(runtime, viewerId, now);
  const result = runtime.lastResults[viewerId];
  if (!result) throw new Error('ARENA_RESULT_VIEW_MISSING');
  return { ...result, serverNow: now, playback: undefined };
}

export function invasionResultViews(runtime: ArenaRuntime, now: number) {
  return Object.fromEntries(
    runtime.participants.map(({ unitId }) => {
      const cached = runtime.lastResults[unitId];
      const view = cached?.revision === runtime.revision
        ? cached
        : arenaView(runtime, unitId, now);
      const playback = view.playback;
      const events = playback
        ? view.events.filter(({ seq }) => seq > playback.fromEventSeq)
        : [];
      return [unitId, {
        ...view,
        events,
        eventWindowStartSeq: events[0]?.seq ?? view.latestEventSeq + 1,
      }];
    }),
  );
}

export function resolveArena(runtime: ArenaRuntime, now: number): ArenaRuntime {
  return resolveArenaRound(runtime, now, arenaView);
}
