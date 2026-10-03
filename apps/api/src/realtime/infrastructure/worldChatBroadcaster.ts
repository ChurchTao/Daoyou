import {
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
} from '@server/realtime/infrastructure/natsCorePubSub.js';
import {
  createPubSubEnvelope,
  parsePubSubEnvelope,
} from '@server/realtime/infrastructure/pubSubEnvelope.js';
import type { WorldChatMessageDTO } from '@daoyou/shared/types/world-chat';

type Listener = (message: WorldChatMessageDTO) => void;

const WORLD_CHAT_SUBJECT = 'daoyou.realtime.world-chat';
const localListeners = new Set<Listener>();
let unsubscribeNats: (() => void) | null = null;

function isWorldChatMessage(value: unknown): value is WorldChatMessageDTO {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string',
  );
}

function parseMessage(raw: string): WorldChatMessageDTO | null {
  return parsePubSubEnvelope(raw, isWorldChatMessage);
}

function ensureNatsSubscription() {
  if (unsubscribeNats) {
    return;
  }

  unsubscribeNats = subscribeNatsCoreSubject(WORLD_CHAT_SUBJECT, (raw) => {
    const message = parseMessage(raw);
    if (message) {
      notifyLocalWorldChatListeners(message);
    }
  });
}

function notifyLocalWorldChatListeners(message: WorldChatMessageDTO) {
  for (const listener of localListeners) {
    listener(message);
  }
}

export function subscribeWorldChatMessages(listener: Listener): () => void {
  localListeners.add(listener);
  ensureNatsSubscription();

  return () => {
    localListeners.delete(listener);
    if (localListeners.size === 0) {
      unsubscribeNats?.();
      unsubscribeNats = null;
    }
  };
}

export function publishWorldChatMessage(message: WorldChatMessageDTO): void {
  notifyLocalWorldChatListeners(message);
  void publishNatsCoreMessage(
    WORLD_CHAT_SUBJECT,
    JSON.stringify(createPubSubEnvelope(message)),
  );
}
