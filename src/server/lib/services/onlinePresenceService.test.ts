import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  redisEvalMock,
  redisGetMock,
  redisZrangeMock,
  redisZremrangebyscoreMock,
  redisState,
} = vi.hoisted(() => {
  const redisState = {
    strings: new Map<string, string>(),
    sets: new Map<string, Set<string>>(),
    sortedSets: new Map<string, Map<string, number>>(),
    failReads: false,
    failWrites: false,
  };

  function parseCultivatorId(member: string): string {
    const index = member.indexOf(':');
    return index >= 0 ? member.slice(index + 1) : member;
  }

  const redisEvalMock = vi.fn(
    async (
      _script: string,
      _keyCount: number,
      connectionsKey: string,
      cultivatorsKey: string,
      todayPeakKey: string,
      allTimePeakKey: string,
      member: string,
      online: string,
      _ttlSeconds: string,
      nowMsRaw: string,
      connectionTtlMsRaw: string,
    ) => {
      if (redisState.failWrites) {
        throw new Error('redis write failed');
      }

      const nowMs = Number(nowMsRaw);
      const connectionTtlMs = Number(connectionTtlMsRaw);
      const connections =
        redisState.sortedSets.get(connectionsKey) ?? new Map<string, number>();
      for (const [connectionMember, expiresAt] of connections) {
        if (expiresAt <= nowMs) {
          connections.delete(connectionMember);
        }
      }
      if (online === '1') {
        connections.set(member, nowMs + connectionTtlMs);
      } else {
        connections.delete(member);
      }
      redisState.sortedSets.set(connectionsKey, connections);

      const cultivators = new Set([...connections.keys()].map(parseCultivatorId));
      redisState.sets.set(cultivatorsKey, cultivators);

      const currentOnline = cultivators.size;
      const todayPeak = Number(redisState.strings.get(todayPeakKey) ?? '0');
      if (currentOnline > todayPeak) {
        redisState.strings.set(todayPeakKey, String(currentOnline));
      }
      const allTimePeak = Number(redisState.strings.get(allTimePeakKey) ?? '0');
      if (currentOnline > allTimePeak) {
        redisState.strings.set(allTimePeakKey, String(currentOnline));
      }
      return currentOnline;
    },
  );

  const redisZrangeMock = vi.fn(async (key: string) => {
    if (redisState.failReads) {
      throw new Error('redis read failed');
    }
    return [...(redisState.sortedSets.get(key)?.keys() ?? [])];
  });

  const redisZremrangebyscoreMock = vi.fn(
    async (key: string, _min: string, max: number) => {
      if (redisState.failReads) {
        throw new Error('redis read failed');
      }
      const bucket = redisState.sortedSets.get(key);
      if (!bucket) {
        return 0;
      }
      let removed = 0;
      for (const [member, score] of bucket) {
        if (score <= max) {
          bucket.delete(member);
          removed += 1;
        }
      }
      return removed;
    },
  );

  const redisGetMock = vi.fn(async (key: string) => {
    if (redisState.failReads) {
      throw new Error('redis read failed');
    }
    return redisState.strings.get(key) ?? null;
  });

  return {
    redisEvalMock,
    redisGetMock,
    redisZrangeMock,
    redisZremrangebyscoreMock,
    redisState,
  };
});

vi.mock('@server/lib/redis', () => ({
  redis: {
    eval: redisEvalMock,
    get: redisGetMock,
    zrange: redisZrangeMock,
    zremrangebyscore: redisZremrangebyscoreMock,
  },
}));

vi.mock('@server/lib/services/pubSubEnvelope', () => ({
  getPubSubInstanceId: () => 'instance-a',
}));

import {
  __recordRealtimeConnectionCloseForTests,
  __recordRealtimeConnectionOpenForTests,
  __resetOnlinePresenceForTests,
  getOnlineUsersSnapshot,
} from './onlinePresenceService';

function todayPeakKey(today: string) {
  return `admin:online:peak:day:${today}`;
}

describe('onlinePresenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisState.strings.clear();
    redisState.sets.clear();
    redisState.sortedSets.clear();
    redisState.failReads = false;
    redisState.failWrites = false;
    __resetOnlinePresenceForTests();
  });

  it('counts multiple connections from the same cultivator as one online user', async () => {
    await __recordRealtimeConnectionOpenForTests('cultivator-1');
    await __recordRealtimeConnectionOpenForTests('cultivator-1');

    const firstSnapshot = await getOnlineUsersSnapshot();
    expect(firstSnapshot.currentOnline).toBe(1);
    expect(firstSnapshot.todayPeakOnline).toBe(1);
    expect(redisEvalMock).toHaveBeenCalledTimes(1);

    await __recordRealtimeConnectionCloseForTests('cultivator-1');
    expect((await getOnlineUsersSnapshot()).currentOnline).toBe(1);

    await __recordRealtimeConnectionCloseForTests('cultivator-1');
    const finalSnapshot = await getOnlineUsersSnapshot();
    expect(finalSnapshot.currentOnline).toBe(0);
    expect(finalSnapshot.todayPeakOnline).toBe(1);
  });

  it('deduplicates cultivators across instance connection members', async () => {
    redisState.sortedSets.set(
      'admin:online:connections:v1',
      new Map([
        ['instance-a:cultivator-1', Date.now() + 90_000],
        ['instance-b:cultivator-1', Date.now() + 90_000],
        ['instance-b:cultivator-2', Date.now() + 90_000],
      ]),
    );
    redisState.strings.set('admin:online:peak:all:v1', '5');

    const snapshot = await getOnlineUsersSnapshot();

    expect(snapshot.source).toBe('redis');
    expect(snapshot.currentOnline).toBe(2);
    expect(snapshot.allTimePeakOnline).toBe(5);
  });

  it('removes expired connection members before reading current online count', async () => {
    redisState.sortedSets.set(
      'admin:online:connections:v1',
      new Map([
        ['instance-a:cultivator-1', Date.now() - 1],
        ['instance-b:cultivator-2', Date.now() + 90_000],
      ]),
    );

    const snapshot = await getOnlineUsersSnapshot();

    expect(snapshot.currentOnline).toBe(1);
  });

  it('updates today and all-time peaks on redis writes', async () => {
    await __recordRealtimeConnectionOpenForTests('cultivator-1');
    await __recordRealtimeConnectionOpenForTests('cultivator-2');
    const snapshot = await getOnlineUsersSnapshot();

    expect(redisState.strings.get(todayPeakKey(snapshot.today))).toBe('2');
    expect(redisState.strings.get('admin:online:peak:all:v1')).toBe('2');
  });

  it('falls back to memory snapshot when redis reads fail', async () => {
    redisState.failWrites = true;
    await expect(
      __recordRealtimeConnectionOpenForTests('cultivator-1'),
    ).rejects.toThrow('redis write failed');

    redisState.failWrites = false;
    redisState.failReads = true;
    const snapshot = await getOnlineUsersSnapshot();

    expect(snapshot.source).toBe('memory');
    expect(snapshot.currentOnline).toBe(1);
    expect(snapshot.todayPeakOnline).toBe(1);
    expect(snapshot.allTimePeakOnline).toBe(1);
  });
});
