import type { PlayerStateEvent } from '@shared/contracts/player';
import {
  createPubSubEnvelope,
  parsePubSubEnvelope,
} from './pubSubEnvelope';
import { publishRedisMessage, subscribeRedisChannel } from './redisPubSub';

type Listener = (events: PlayerStateEvent[]) => void;

const PLAYER_STATE_CHANNEL_PREFIX = 'player-state:';
const listeners = new Map<string, Set<Listener>>();
const redisSubscriptions = new Map<string, () => void>();

function channelForCultivator(cultivatorId: string): string {
  return `${PLAYER_STATE_CHANNEL_PREFIX}${cultivatorId}`;
}

function isPlayerStateEvents(value: unknown): value is PlayerStateEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (event) =>
        event &&
        typeof event === 'object' &&
        typeof (event as { id?: unknown }).id === 'number' &&
        typeof (event as { globalVersion?: unknown }).globalVersion === 'number',
    )
  );
}

function parseEvents(raw: string): PlayerStateEvent[] {
  return parsePubSubEnvelope(raw, isPlayerStateEvents) ?? [];
}

function ensureRedisSubscription(cultivatorId: string) {
  if (redisSubscriptions.has(cultivatorId)) {
    return;
  }

  const unsubscribe = subscribeRedisChannel(
    channelForCultivator(cultivatorId),
    (raw) => {
      const events = parseEvents(raw);
      if (events.length > 0) {
        notifyLocalPlayerStateListeners(cultivatorId, events);
      }
    },
  );
  redisSubscriptions.set(cultivatorId, unsubscribe);
}

function notifyLocalPlayerStateListeners(
  cultivatorId: string,
  events: PlayerStateEvent[],
) {
  const set = listeners.get(cultivatorId);
  if (!set) {
    return;
  }

  for (const listener of set) {
    listener(events);
  }
}

export function subscribePlayerStateEvents(
  cultivatorId: string,
  listener: Listener,
): () => void {
  const set = listeners.get(cultivatorId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(cultivatorId, set);
  ensureRedisSubscription(cultivatorId);

  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(cultivatorId);
      redisSubscriptions.get(cultivatorId)?.();
      redisSubscriptions.delete(cultivatorId);
    }
  };
}

export function publishPlayerStateEvents(
  cultivatorId: string,
  events: PlayerStateEvent[],
) {
  if (events.length === 0) {
    return;
  }

  notifyLocalPlayerStateListeners(cultivatorId, events);
  void publishRedisMessage(
    channelForCultivator(cultivatorId),
    JSON.stringify(createPubSubEnvelope(events)),
  );
}
