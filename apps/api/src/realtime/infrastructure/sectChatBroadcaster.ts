import {
  encodeNatsSubjectToken,
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
} from '@server/realtime/infrastructure/natsCorePubSub.js';
import {
  createPubSubEnvelope,
  parsePubSubEnvelope,
} from '@server/realtime/infrastructure/pubSubEnvelope.js';
import type { WorldChatMessageDTO } from '@daoyou/shared/types/world-chat';

type Listener = (message: WorldChatMessageDTO) => void;
type SectSubscription = {
  listeners: Set<Listener>;
  unsubscribeNats: () => void;
};

const subscriptions = new Map<string, SectSubscription>();

function subjectForSect(sectId: string) {
  return `daoyou.realtime.sect-chat.${encodeNatsSubjectToken(sectId)}`;
}

function isSectChatMessage(value: unknown): value is WorldChatMessageDTO {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as { channel?: unknown }).channel === 'sect' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { sectId?: unknown }).sectId === 'string',
  );
}

function notify(subscription: SectSubscription, message: WorldChatMessageDTO) {
  for (const listener of subscription.listeners) {
    listener(message);
  }
}

export function subscribeSectChatMessages(
  sectId: string,
  listener: Listener,
): () => void {
  let subscription = subscriptions.get(sectId);
  if (!subscription) {
    const listeners = new Set<Listener>();
    const created: SectSubscription = {
      listeners,
      unsubscribeNats: subscribeNatsCoreSubject(
        subjectForSect(sectId),
        (raw) => {
          const message = parsePubSubEnvelope(raw, isSectChatMessage);
          if (message?.sectId === sectId) {
            notify(created, message);
          }
        },
      ),
    };
    subscription = created;
    subscriptions.set(sectId, created);
  }

  subscription.listeners.add(listener);
  return () => {
    const current = subscriptions.get(sectId);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    current.unsubscribeNats();
    subscriptions.delete(sectId);
  };
}

export function publishSectChatMessage(
  sectId: string,
  message: WorldChatMessageDTO,
): void {
  const subscription = subscriptions.get(sectId);
  if (subscription) {
    notify(subscription, message);
  }
  void publishNatsCoreMessage(
    subjectForSect(sectId),
    JSON.stringify(createPubSubEnvelope(message)),
  );
}
