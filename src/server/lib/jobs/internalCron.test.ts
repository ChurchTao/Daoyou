import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prunePlayerStateEventsOlderThanMock, redisMock } = vi.hoisted(() => ({
  prunePlayerStateEventsOlderThanMock: vi.fn(),
  redisMock: {
    set: vi.fn(),
    eval: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('@server/lib/redis', () => ({
  redis: redisMock,
}));

vi.mock('@server/lib/redis/rankings', () => ({
  getTopRankingCultivatorIds: vi.fn(),
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

vi.mock('@server/lib/services/MarketScheduler', () => ({
  runMarketRefreshJob: vi.fn(),
}));

vi.mock('@server/lib/tower/enemySets', () => ({
  towerEnemySetService: {
    refreshCurrentAndNextIfNeeded: vi.fn(),
  },
}));

import { runPlayerStateEventsCleanupJob } from './internalCron';

describe('internal cron jobs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T00:00:00.000Z'));
    vi.clearAllMocks();
    redisMock.set.mockResolvedValue('OK');
    redisMock.eval.mockResolvedValue(1);
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
});
