import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getExecutorMock,
  getTopRankingCultivatorIdsMock,
  prunePlayerStateEventsOlderThanMock,
  redisMock,
  updateReputationMock,
} = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  getTopRankingCultivatorIdsMock: vi.fn(),
  prunePlayerStateEventsOlderThanMock: vi.fn(),
  redisMock: {
    set: vi.fn(),
    eval: vi.fn(),
    exists: vi.fn(),
  },
  updateReputationMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/redis', () => ({
  redis: redisMock,
}));

vi.mock('@server/lib/redis/rankings', () => ({
  getTopRankingCultivatorIds: getTopRankingCultivatorIdsMock,
}));

vi.mock('@server/lib/repositories/playerStateRepository', () => ({
  prunePlayerStateEventsOlderThan: prunePlayerStateEventsOlderThanMock,
}));

vi.mock('@server/lib/services/AuctionService', () => ({
  expireListings: vi.fn(),
}));

vi.mock('@server/lib/services/BetBattleService', () => ({
  expireBetBattles: vi.fn(),
}));

vi.mock('@server/lib/services/MailService', () => ({
  MailService: {
    sendMail: vi.fn(),
  },
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  updateReputation: updateReputationMock,
}));

vi.mock('@server/lib/services/MarketScheduler', () => ({
  runMarketRefreshJob: vi.fn(),
}));

vi.mock('@server/lib/tower/enemySets', () => ({
  towerEnemySetService: {
    refreshCurrentAndNextIfNeeded: vi.fn(),
  },
}));

import {
  runPlayerStateEventsCleanupJob,
  runRankRewardsJob,
} from './internalCron';

describe('internal cron jobs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T00:00:00.000Z'));
    vi.clearAllMocks();
    redisMock.set.mockResolvedValue('OK');
    redisMock.eval.mockResolvedValue(1);
    redisMock.exists.mockResolvedValue(0);
    getExecutorMock.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ userId: 'user-1' }]),
          })),
        })),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps only the latest 2 days of player state events', async () => {
    prunePlayerStateEventsOlderThanMock.mockResolvedValueOnce(42);

    await expect(runPlayerStateEventsCleanupJob()).resolves.toEqual({
      success: true,
      processed: 42,
      skipped: false,
    });

    expect(prunePlayerStateEventsOlderThanMock).toHaveBeenCalledWith(
      new Date('2026-06-09T00:00:00.000Z'),
    );
  });

  it('settles rank rewards as reputation instead of spirit stone mail', async () => {
    getTopRankingCultivatorIdsMock.mockResolvedValueOnce([
      'cultivator-1',
      'cultivator-2',
    ]);

    await expect(runRankRewardsJob()).resolves.toMatchObject({
      success: true,
      processed: 2,
      skipped: false,
      logs: ['Rank 1: +30000 reputation', 'Rank 2: +20000 reputation'],
    });

    expect(updateReputationMock).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'cultivator-1',
      30000,
    );
    expect(updateReputationMock).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'cultivator-2',
      20000,
    );
  });
});
