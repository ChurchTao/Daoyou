import type { WorldChatMessageDTO } from '@shared/types/world-chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { publishRedisMessageMock, subscribeRedisChannelMock } = vi.hoisted(() => ({
  publishRedisMessageMock: vi.fn(),
  subscribeRedisChannelMock: vi.fn(
    (_channel: string, _handler: (raw: string) => void) => vi.fn(),
  ),
}));

vi.mock('@server/lib/services/redisPubSub', () => ({
  publishRedisMessage: publishRedisMessageMock,
  subscribeRedisChannel: subscribeRedisChannelMock,
}));

import {
  getPubSubInstanceId,
  type PubSubEnvelope,
} from './pubSubEnvelope';
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
    const [, raw] = publishRedisMessageMock.mock.calls[0];
    const envelope = JSON.parse(raw) as PubSubEnvelope<WorldChatMessageDTO>;
    expect(envelope.payload).toEqual(message);
    expect(envelope.sourceInstanceId).toBe(getPubSubInstanceId());
  });

  it('ignores redis messages from the same instance and accepts external envelopes', () => {
    const redisHandlers: Array<(raw: string) => void> = [];
    subscribeRedisChannelMock.mockImplementationOnce((_channel, handler) => {
      redisHandlers.push(handler);
      return vi.fn();
    });
    const listener = vi.fn();
    const message = createMessage();

    const unsubscribe = subscribeWorldChatMessages(listener);
    redisHandlers[0]?.(
      JSON.stringify({
        sourceInstanceId: getPubSubInstanceId(),
        payload: message,
      }),
    );
    redisHandlers[0]?.(
      JSON.stringify({
        sourceInstanceId: 'other-instance',
        payload: message,
      }),
    );
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(message);
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
