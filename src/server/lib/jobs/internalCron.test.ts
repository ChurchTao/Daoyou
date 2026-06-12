import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getExecutorMock,
  getTopRankingCultivatorIdsMock,
  commitPlayerStateMutationMock,
  prunePlayerStateEventsOlderThanMock,
  redisMock,
  updateReputationMock,
} = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  getTopRankingCultivatorIdsMock: vi.fn(),
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const { changes } = await input.run('tx');
    return {
      result: null,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 1,
        domainVersions: { currency: 1 },
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          ...change,
        })),
      },
    };
  }),
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

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
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
    vi.setSystemTime(new Date('2026-06-14T16:05:00.000Z'));
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
    vi.setSystemTime(new Date('2026-06-11T00:00:00.000Z'));
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

  it('settles weekly rank rewards as reputation and emits currency events', async () => {
    getTopRankingCultivatorIdsMock.mockResolvedValueOnce(
      Array.from({ length: 51 }, (_, index) => `cultivator-${index + 1}`),
    );
    updateReputationMock.mockImplementation(
      async (_userId, _cultivatorId, delta) => delta + 1,
    );

    await expect(runRankRewardsJob()).resolves.toMatchObject({
      success: true,
      processed: 51,
      skipped: false,
      settlementDate: '2026-06-15',
      logs: expect.arrayContaining([
        'Rank 1: +100 reputation',
        'Rank 2: +50 reputation',
        'Rank 10: +50 reputation',
        'Rank 11: +25 reputation',
        'Rank 50: +25 reputation',
        'Rank 51: +15 reputation',
      ]),
    });

    expect(commitPlayerStateMutationMock).toHaveBeenCalledTimes(51);
    expect(updateReputationMock).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'cultivator-1',
      100,
      'tx',
    );
    expect(updateReputationMock).toHaveBeenNthCalledWith(
      11,
      'user-1',
      'cultivator-11',
      25,
      'tx',
    );
    expect(updateReputationMock).toHaveBeenNthCalledWith(
      51,
      'user-1',
      'cultivator-51',
      15,
      'tx',
    );
    expect(commitPlayerStateMutationMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'rank_weekly_rewards',
      }),
    );
    await expect(
      commitPlayerStateMutationMock.mock.results[0].value,
    ).resolves.toMatchObject({
      state: {
        events: [
          expect.objectContaining({
            domain: 'currency',
            eventType: 'currency.reputation.gained',
            patch: { currency: { reputation: 101 } },
          }),
        ],
      },
    });
    expect(redisMock.set).toHaveBeenCalledWith(
      'golden_rank:weekly_rewards:settled:2026-06-15',
      expect.any(String),
      'EX',
      604800,
    );
  });

  it('skips weekly rank rewards after the week is already settled', async () => {
    redisMock.exists.mockResolvedValueOnce(1);

    await expect(runRankRewardsJob()).resolves.toMatchObject({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'already_settled_today',
      settlementDate: '2026-06-15',
    });

    expect(getTopRankingCultivatorIdsMock).not.toHaveBeenCalled();
    expect(commitPlayerStateMutationMock).not.toHaveBeenCalled();
  });

  it('skips weekly rank rewards outside Monday in Asia Shanghai', async () => {
    vi.setSystemTime(new Date('2026-06-15T16:05:00.000Z'));

    await expect(runRankRewardsJob()).resolves.toMatchObject({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'not_settlement_day',
      settlementDate: '2026-06-16',
    });

    expect(getTopRankingCultivatorIdsMock).not.toHaveBeenCalled();
  });
});
