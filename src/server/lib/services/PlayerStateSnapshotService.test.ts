import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOrCreateStateVersionMock } = vi.hoisted(() => ({
  getOrCreateStateVersionMock: vi.fn(),
}));

vi.mock('@server/lib/repositories/playerStateRepository', () => ({
  getOrCreateStateVersion: getOrCreateStateVersionMock,
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorById: vi.fn(),
}));

import { buildPlayerStateSnapshot } from './PlayerStateSnapshotService';

const zeroDomainVersions = {
  profile: 0,
  condition: 0,
  progress: 0,
  currency: 0,
  inventory: 0,
  products: 0,
  mail: 0,
  tasks: 0,
};

describe('PlayerStateSnapshotService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    getOrCreateStateVersionMock.mockResolvedValue({
      globalVersion: 1,
      domainVersions: zeroDomainVersions,
    });
  });

  it('returns effective hourly restored qi in currency snapshots', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T02:20:00+08:00'));
    const q = {
      query: {
        cultivators: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'cultivator-1',
            spirit_stones: 123,
            qi: 40,
            qiLastRefreshedAt: new Date('2026-06-06T00:00:00+08:00'),
          }),
        },
      },
    } as unknown as Parameters<typeof buildPlayerStateSnapshot>[0]['q'];

    const snapshot = await buildPlayerStateSnapshot({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      domains: ['currency'],
      q,
    });

    expect(snapshot.snapshot.currency).toEqual({
      spiritStones: 123,
      qi: 60,
      qiLastRefreshedAt: new Date('2026-06-06T02:00:00+08:00').toISOString(),
    });
  });
});
