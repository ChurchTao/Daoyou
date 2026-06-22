import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getExecutorMock,
  getTopRankingCultivatorIdsMock,
  commitPlayerStateMutationMock,
  sendMailMock,
  pruneExpiredDataMock,
  prunePlayerStateEventsOlderThanMock,
  getItemLibraryDailyMaterialGenerationSettingsMock,
  generateRandomMaterialLibraryEntriesMock,
  redisMock,
  transactionMock,
} = vi.hoisted(() => {
  const tx = {
    select: vi.fn(),
  };

  return {
    getExecutorMock: vi.fn(),
    getTopRankingCultivatorIdsMock: vi.fn(),
    commitPlayerStateMutationMock: vi.fn(async (input: any) => {
      const { changes } = await input.run(tx);
      return {
        result: null,
        state: {
          cultivatorId: input.cultivatorId,
          globalVersion: 1,
          domainVersions: { mail: 1 },
          events: changes.map((change: any, index: number) => ({
            id: index + 1,
            ...change,
          })),
        },
      };
    }),
    pruneExpiredDataMock: vi.fn(),
    prunePlayerStateEventsOlderThanMock: vi.fn(),
    redisMock: {
      set: vi.fn(),
      eval: vi.fn(),
      exists: vi.fn(),
    },
    sendMailMock: vi.fn(),
    transactionMock: tx,
    getItemLibraryDailyMaterialGenerationSettingsMock: vi.fn(),
    generateRandomMaterialLibraryEntriesMock: vi.fn(),
  };
});

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

vi.mock('@server/lib/repositories/retentionRepository', () => ({
  pruneExpiredData: pruneExpiredDataMock,
}));

vi.mock('@server/lib/repositories/appSettingsRepository', () => ({
  getItemLibraryDailyMaterialGenerationSettings:
    getItemLibraryDailyMaterialGenerationSettingsMock,
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
    sendMail: sendMailMock,
  },
}));

vi.mock('@server/lib/services/MarketScheduler', () => ({
  runMarketRefreshJob: vi.fn(),
}));

vi.mock('@server/lib/services/MaterialLibraryService', () => ({
  ITEM_LIBRARY_SYSTEM_USER_ID: '00000000-0000-4000-8000-000000000000',
  generateRandomMaterialLibraryEntries: generateRandomMaterialLibraryEntriesMock,
}));

vi.mock('@server/lib/tower/enemySets', () => ({
  towerEnemySetService: {
    refreshCurrentAndNextIfNeeded: vi.fn(),
  },
}));

import {
  runExpiredDataCleanupJob,
  runMaterialLibraryDailyGenerationJob,
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
    getItemLibraryDailyMaterialGenerationSettingsMock.mockResolvedValue({
      enabled: true,
      count: 20,
    });
    generateRandomMaterialLibraryEntriesMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` })),
    );
    sendMailMock.mockImplementation(async (cultivatorId: string) => ({
      id: `mail-${cultivatorId}`,
    }));
    transactionMock.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ count: 1 }]),
      })),
    });
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

  it('cleans expired durable data with table-specific retention windows', async () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    pruneExpiredDataMock.mockResolvedValueOnce({
      mails: 2,
      qiLogs: 3,
      dungeonHistories: 4,
      dungeonRuns: 5,
      battleRecordsV2: 6,
      reputationShopPurchases: 7,
      auctionListings: 8,
    });

    await expect(runExpiredDataCleanupJob()).resolves.toEqual({
      success: true,
      processed: 35,
      skipped: false,
      deleted: {
        mails: 2,
        qiLogs: 3,
        dungeonHistories: 4,
        dungeonRuns: 5,
        battleRecordsV2: 6,
        reputationShopPurchases: 7,
        auctionListings: 8,
      },
    });

    expect(pruneExpiredDataMock).toHaveBeenCalledWith({
      mails: new Date('2026-06-01T12:00:00.000Z'),
      qiLogs: new Date('2026-06-01T12:00:00.000Z'),
      dungeonHistories: new Date('2026-06-08T12:00:00.000Z'),
      dungeonRuns: new Date('2026-06-08T12:00:00.000Z'),
      battleRecordsV2: new Date('2026-06-08T12:00:00.000Z'),
      reputationShopPurchases: new Date('2026-05-25T12:00:00.000Z'),
      auctionListings: new Date('2026-06-01T12:00:00.000Z'),
    });
  });

  it('generates daily random materials with default settings', async () => {
    await expect(runMaterialLibraryDailyGenerationJob()).resolves.toEqual({
      success: true,
      processed: 20,
      skipped: false,
    });

    expect(getItemLibraryDailyMaterialGenerationSettingsMock).toHaveBeenCalledTimes(
      1,
    );
    expect(generateRandomMaterialLibraryEntriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 20,
        userId: '00000000-0000-4000-8000-000000000000',
        source: 'daily_cron',
      }),
    );
  });

  it('skips daily random material generation when disabled', async () => {
    getItemLibraryDailyMaterialGenerationSettingsMock.mockResolvedValueOnce({
      enabled: false,
      count: 20,
    });

    await expect(runMaterialLibraryDailyGenerationJob()).resolves.toEqual({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'disabled',
    });

    expect(generateRandomMaterialLibraryEntriesMock).not.toHaveBeenCalled();
  });

  it('uses the configured daily random material count', async () => {
    getItemLibraryDailyMaterialGenerationSettingsMock.mockResolvedValueOnce({
      enabled: true,
      count: 7,
    });
    generateRandomMaterialLibraryEntriesMock.mockResolvedValueOnce(
      Array.from({ length: 7 }, (_, index) => ({ id: `item-${index}` })),
    );

    await expect(runMaterialLibraryDailyGenerationJob()).resolves.toEqual({
      success: true,
      processed: 7,
      skipped: false,
    });

    expect(generateRandomMaterialLibraryEntriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ count: 7 }),
    );
  });

  it('skips daily random material generation when another instance holds the lock', async () => {
    redisMock.set.mockResolvedValueOnce(null);

    await expect(runMaterialLibraryDailyGenerationJob()).resolves.toEqual({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'job_in_progress',
    });

    expect(getItemLibraryDailyMaterialGenerationSettingsMock).not.toHaveBeenCalled();
    expect(generateRandomMaterialLibraryEntriesMock).not.toHaveBeenCalled();
  });

  it('settles weekly rank rewards as reputation mail and emits mail events', async () => {
    getTopRankingCultivatorIdsMock.mockImplementation(async (realm: string) => {
      if (realm !== '筑基') return [];
      return Array.from(
        { length: 51 },
        (_, index) => `cultivator-${index + 1}`,
      );
    });

    await expect(runRankRewardsJob()).resolves.toMatchObject({
      success: true,
      processed: 51,
      skipped: false,
      settlementDate: '2026-06-15',
      logs: expect.arrayContaining([
        '筑基 Rank 1: mailed +100 reputation',
        '筑基 Rank 2: mailed +50 reputation',
        '筑基 Rank 10: mailed +50 reputation',
        '筑基 Rank 11: mailed +25 reputation',
        '筑基 Rank 50: mailed +25 reputation',
        '筑基 Rank 51: mailed +15 reputation',
      ]),
    });

    expect(getTopRankingCultivatorIdsMock).toHaveBeenCalledWith('炼气', 100);
    expect(getTopRankingCultivatorIdsMock).toHaveBeenCalledWith('筑基', 100);
    expect(commitPlayerStateMutationMock).toHaveBeenCalledTimes(51);
    expect(sendMailMock).toHaveBeenCalledTimes(51);
    expect(sendMailMock).toHaveBeenNthCalledWith(
      1,
      'cultivator-1',
      '天骄榜每周声望奖励',
      expect.stringContaining('筑基天骄榜位列第 1 名'),
      [{ type: 'reputation', name: '声望', quantity: 100 }],
      'reward',
      transactionMock,
    );
    expect(sendMailMock).toHaveBeenNthCalledWith(
      11,
      'cultivator-11',
      '天骄榜每周声望奖励',
      expect.stringContaining('筑基天骄榜位列第 11 名'),
      [{ type: 'reputation', name: '声望', quantity: 25 }],
      'reward',
      transactionMock,
    );
    expect(sendMailMock).toHaveBeenNthCalledWith(
      51,
      'cultivator-51',
      '天骄榜每周声望奖励',
      expect.stringContaining('筑基天骄榜位列第 51 名'),
      [{ type: 'reputation', name: '声望', quantity: 15 }],
      'reward',
      transactionMock,
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
            domain: 'mail',
            eventType: 'mail.rank_weekly_reward.created',
            patch: {
              unreadMailCount: 1,
              mailIds: ['mail-cultivator-1'],
            },
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
