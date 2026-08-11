import {
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
} from '@server/lib/services/natsCorePubSub';
import {
  createPubSubEnvelope,
  parsePubSubEnvelope,
} from '@server/lib/services/pubSubEnvelope';
import { encodeNatsSubjectToken } from '@server/lib/services/natsCorePubSub';
import type { ArenaRoomChangedPayloadV1 } from '@shared/contracts/realtime';
import type { ArenaRoomV1 } from '@shared/contracts/arena';

const SUBJECT_PREFIX = 'daoyou.realtime.arena-room.user';
const ROOM_STATUSES = new Set([
  'assembling',
  'ready_check',
  'starting',
  'in_battle',
  'finished',
  'cancelled',
  'expired',
]);
type Listener = (payload: ArenaRoomChangedPayloadV1) => void;
const listeners = new Map<string, Set<Listener>>();
const subscriptions = new Map<string, () => void>();

function subjectForUser(userId: string): string {
  return `${SUBJECT_PREFIX}.${encodeNatsSubjectToken(userId)}`;
}

function isArenaRoomChangedPayload(
  value: unknown,
): value is ArenaRoomChangedPayloadV1 {
  const room = (value as { room?: unknown }).room;
  const validRoom = room === undefined || isArenaRoom(room);
  return Boolean(
    validRoom &&
    value &&
      typeof value === 'object' &&
      typeof (value as { roomId?: unknown }).roomId === 'string' &&
      typeof (value as { revision?: unknown }).revision === 'number' &&
      typeof (value as { status?: unknown }).status === 'string' &&
      ROOM_STATUSES.has((value as { status: string }).status),
  );
}

function isArenaRoom(value: unknown): value is ArenaRoomV1 {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { version?: unknown }).version === 'arena_room_v1' &&
      typeof (value as { roomId?: unknown }).roomId === 'string',
  );
}

export function subscribeArenaRoomChanges(
  userId: string,
  listener: Listener,
): () => void {
  const set = listeners.get(userId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(userId, set);

  if (!subscriptions.has(userId)) {
    subscriptions.set(
      userId,
      subscribeNatsCoreSubject(subjectForUser(userId), (raw) => {
        const payload = parsePubSubEnvelope(raw, isArenaRoomChangedPayload);
        if (!payload) return;
        for (const current of listeners.get(userId) ?? []) current(payload);
      }),
    );
  }

  return () => {
    set.delete(listener);
    if (set.size > 0) return;
    listeners.delete(userId);
    subscriptions.get(userId)?.();
    subscriptions.delete(userId);
  };
}

export function publishArenaRoomChanges(
  userIds: readonly string[],
  payload: ArenaRoomChangedPayloadV1,
): void {
  for (const userId of new Set(userIds)) {
    // NATS envelopes deliberately suppress messages published by the same
    // process. Dispatch locally as well so WebSocket clients connected to
    // this API instance receive room changes without an HTTP round trip.
    for (const listener of listeners.get(userId) ?? []) {
      try {
        listener(payload);
      } catch (error) {
        console.warn('[arena-room] local listener failed', {
          userId,
          error,
        });
      }
    }
    void publishNatsCoreMessage(
      subjectForUser(userId),
      JSON.stringify(createPubSubEnvelope(payload)),
    );
  }
}
