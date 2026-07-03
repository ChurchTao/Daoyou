import type { PlayerStateEvent } from '@shared/contracts/player';
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
  publishPlayerStateEvents,
  subscribePlayerStateEvents,
} from './playerStateBroadcaster';

function createEvent(id = 1): PlayerStateEvent {
  return {
    id,
    cultivatorId: 'cultivator-1',
    globalVersion: id,
    domainVersion: id,
    domain: 'mail',
    eventType: 'mail.changed',
    patch: { unreadMailCount: id },
    invalidates: [],
    source: 'test',
    createdAt: '2026-07-03T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeRedisChannelMock.mockReturnValue(vi.fn());
});

describe('playerStateBroadcaster', () => {
  it('notifies local listeners and publishes redis fanout', () => {
    const listener = vi.fn();
    const events = [createEvent()];

    const unsubscribe = subscribePlayerStateEvents('cultivator-1', listener);
    publishPlayerStateEvents('cultivator-1', events);
    unsubscribe();

    expect(listener).toHaveBeenCalledWith(events);
    const [, raw] = publishRedisMessageMock.mock.calls[0];
    const envelope = JSON.parse(raw) as PubSubEnvelope<PlayerStateEvent[]>;
    expect(envelope.payload).toEqual(events);
    expect(envelope.sourceInstanceId).toBe(getPubSubInstanceId());
  });

  it('ignores redis messages from the same instance and accepts external envelopes', () => {
    const redisHandlers: Array<(raw: string) => void> = [];
    subscribeRedisChannelMock.mockImplementationOnce((_channel, handler) => {
      redisHandlers.push(handler);
      return vi.fn();
    });
    const listener = vi.fn();
    const events = [createEvent()];

    const unsubscribe = subscribePlayerStateEvents('cultivator-1', listener);
    redisHandlers[0]?.(
      JSON.stringify({
        sourceInstanceId: getPubSubInstanceId(),
        payload: events,
      }),
    );
    redisHandlers[0]?.(
      JSON.stringify({
        sourceInstanceId: 'other-instance',
        payload: events,
      }),
    );
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(events);
  });

  it('cleans up redis subscription when the last listener unsubscribes', () => {
    const unsubscribeRedis = vi.fn();
    subscribeRedisChannelMock.mockReturnValueOnce(unsubscribeRedis);

    const unsubscribeA = subscribePlayerStateEvents('cultivator-1', vi.fn());
    const unsubscribeB = subscribePlayerStateEvents('cultivator-1', vi.fn());
    unsubscribeA();
    expect(unsubscribeRedis).not.toHaveBeenCalled();

    unsubscribeB();
    expect(unsubscribeRedis).toHaveBeenCalled();
  });
});
