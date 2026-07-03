import type { PlayerStateEvent } from '@shared/contracts/player';
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
    expect(publishRedisMessageMock).toHaveBeenCalledWith(
      'player-state:cultivator-1',
      JSON.stringify(events),
    );
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
