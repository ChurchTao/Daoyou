import type { HuntTeamChatMessage } from '@daoyou/contracts/hunts';
import {
  encodeNatsSubjectToken,
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
} from '@server/realtime/infrastructure/natsCorePubSub.js';
import {
  createPubSubEnvelope,
  parsePubSubEnvelope,
} from '@server/realtime/infrastructure/pubSubEnvelope.js';

const SUBJECT_PREFIX = 'daoyou.realtime.hunt-team-chat.user';
type Listener = (message: HuntTeamChatMessage) => void;
const listeners = new Map<string, Set<Listener>>();
const subscriptions = new Map<string, () => void>();

function subjectForUser(userId: string) {
  return `${SUBJECT_PREFIX}.${encodeNatsSubjectToken(userId)}`;
}

function isHuntTeamChatMessage(value: unknown): value is HuntTeamChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<HuntTeamChatMessage>;
  return (
    typeof message.id === 'string' &&
    typeof message.teamId === 'string' &&
    typeof message.senderCultivatorId === 'string' &&
    typeof message.senderName === 'string' &&
    typeof message.text === 'string' &&
    typeof message.createdAt === 'string'
  );
}

export function subscribeHuntTeamChat(
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
        const message = parsePubSubEnvelope(raw, isHuntTeamChatMessage);
        if (!message) return;
        for (const current of listeners.get(userId) ?? []) current(message);
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

export function publishHuntTeamChat(
  userIds: readonly string[],
  message: HuntTeamChatMessage,
) {
  for (const userId of new Set(userIds)) {
    for (const listener of listeners.get(userId) ?? []) listener(message);
    void publishNatsCoreMessage(
      subjectForUser(userId),
      JSON.stringify(createPubSubEnvelope(message)),
    );
  }
}
