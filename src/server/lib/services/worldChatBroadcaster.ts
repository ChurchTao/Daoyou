import { publishRedisMessage, subscribeRedisChannel } from '@server/lib/services/redisPubSub';
import type { WorldChatMessageDTO } from '@shared/types/world-chat';

type Listener = (message: WorldChatMessageDTO) => void;

const WORLD_CHAT_CHANNEL = 'world-chat';
const localListeners = new Set<Listener>();
let unsubscribeRedis: (() => void) | null = null;

function parseMessage(raw: string): WorldChatMessageDTO | null {
  try {
    const parsed = JSON.parse(raw) as WorldChatMessageDTO;
    if (!parsed || typeof parsed.id !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function ensureRedisSubscription() {
  if (unsubscribeRedis) {
    return;
  }

  unsubscribeRedis = subscribeRedisChannel(WORLD_CHAT_CHANNEL, (raw) => {
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
  ensureRedisSubscription();

  return () => {
    localListeners.delete(listener);
    if (localListeners.size === 0) {
      unsubscribeRedis?.();
      unsubscribeRedis = null;
    }
  };
}

export function publishWorldChatMessage(message: WorldChatMessageDTO): void {
  notifyLocalWorldChatListeners(message);
  void publishRedisMessage(WORLD_CHAT_CHANNEL, JSON.stringify(message));
}
