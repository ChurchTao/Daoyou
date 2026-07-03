import type { WorldChatMessageDTO } from '@shared/types/world-chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { publishRedisMessageMock, subscribeRedisChannelMock } = vi.hoisted(() => ({
  publishRedisMessageMock: vi.fn(),
  subscribeRedisChannelMock: vi.fn(() => vi.fn()),
}));

vi.mock('@server/lib/services/redisPubSub', () => ({
  publishRedisMessage: publishRedisMessageMock,
  subscribeRedisChannel: subscribeRedisChannelMock,
}));

import {
  publishWorldChatMessage,
  subscribeWorldChatMessages,
} from './worldChatBroadcaster';

function createMessage(id = 'message-1'): WorldChatMessageDTO {
  return {
    id,
    channel: 'world',
    senderUserId: 'user-1',
    senderCultivatorId: 'cultivator-1',
    senderName: '林玄',
    senderRealm: '炼气',
    senderRealmStage: '初期',
    messageType: 'text',
    textContent: '诸位道友',
    payload: { text: '诸位道友' },
    status: 'active',
    createdAt: '2026-07-03T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeRedisChannelMock.mockReturnValue(vi.fn());
});

describe('worldChatBroadcaster', () => {
  it('notifies local listeners and publishes redis fanout', () => {
    const listener = vi.fn();
    const message = createMessage();

    const unsubscribe = subscribeWorldChatMessages(listener);
    publishWorldChatMessage(message);
    unsubscribe();

    expect(listener).toHaveBeenCalledWith(message);
    expect(publishRedisMessageMock).toHaveBeenCalledWith(
      'world-chat',
      JSON.stringify(message),
    );
  });

  it('cleans up subscriptions when the last listener unsubscribes', () => {
    const unsubscribeRedis = vi.fn();
    subscribeRedisChannelMock.mockReturnValueOnce(unsubscribeRedis);

    const unsubscribeA = subscribeWorldChatMessages(vi.fn());
    const unsubscribeB = subscribeWorldChatMessages(vi.fn());
    unsubscribeA();
    expect(unsubscribeRedis).not.toHaveBeenCalled();

    unsubscribeB();
    expect(unsubscribeRedis).toHaveBeenCalled();
  });
});
