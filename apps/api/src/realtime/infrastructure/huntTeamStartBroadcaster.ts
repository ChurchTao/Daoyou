import type { RealtimeServerEvent } from '@daoyou/contracts/realtime';
import {
  encodeNatsSubjectToken,
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
} from './natsCorePubSub.js';
import { createPubSubEnvelope, parsePubSubEnvelope } from './pubSubEnvelope.js';

type Payload = Extract<
  RealtimeServerEvent,
  { type: 'hunt-team.started' }
>['payload'];
type Listener = (payload: Payload) => void;
const listeners = new Map<string, Set<Listener>>();
const subscriptions = new Map<string, () => void>();
const subjectForUser = (userId: string) =>
  `daoyou.realtime.hunt-team-start.user.${encodeNatsSubjectToken(userId)}`;

function isPayload(value: unknown): value is Payload {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as Partial<Payload>).teamId === 'string',
  );
}

export function subscribeHuntTeamStart(userId: string, listener: Listener) {
  const set = listeners.get(userId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(userId, set);
  if (!subscriptions.has(userId)) {
    subscriptions.set(
      userId,
      subscribeNatsCoreSubject(subjectForUser(userId), (raw) => {
        const payload = parsePubSubEnvelope(raw, isPayload);
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

export function publishHuntTeamStart(
  userIds: readonly string[],
  payload: Payload,
) {
  for (const userId of new Set(userIds)) {
    for (const listener of listeners.get(userId) ?? []) {
      try {
        listener(payload);
      } catch (error) {
        console.warn('[hunt-team-start] local listener failed', {
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
