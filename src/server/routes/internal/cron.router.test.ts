import { Hono } from 'hono';

const {
  runAuctionExpireJobMock,
  runBetBattleExpireJobMock,
  runExpiredDataCleanupJobMock,
  runMarketRefreshCronJobMock,
  runMaterialLibraryDailyGenerationJobMock,
  runPlayerStateEventsCleanupJobMock,
  runRankRewardsJobMock,
  runSectConstructionWeeklyJobMock,
  runTowerEnemySetRefreshJobMock,
} = vi.hoisted(() => ({
  runAuctionExpireJobMock: vi.fn(),
  runBetBattleExpireJobMock: vi.fn(),
  runExpiredDataCleanupJobMock: vi.fn(),
  runMarketRefreshCronJobMock: vi.fn(),
  runMaterialLibraryDailyGenerationJobMock: vi.fn(),
  runPlayerStateEventsCleanupJobMock: vi.fn(),
  runRankRewardsJobMock: vi.fn(),
  runSectConstructionWeeklyJobMock: vi.fn(),
  runTowerEnemySetRefreshJobMock: vi.fn(),
}));

vi.mock('@server/lib/jobs/internalCron', () => ({
  runAuctionExpireJob: runAuctionExpireJobMock,
  runBetBattleExpireJob: runBetBattleExpireJobMock,
  runExpiredDataCleanupJob: runExpiredDataCleanupJobMock,
  runMarketRefreshCronJob: runMarketRefreshCronJobMock,
  runMaterialLibraryDailyGenerationJob:
    runMaterialLibraryDailyGenerationJobMock,
  runPlayerStateEventsCleanupJob: runPlayerStateEventsCleanupJobMock,
  runRankRewardsJob: runRankRewardsJobMock,
  runSectConstructionWeeklyJob: runSectConstructionWeeklyJobMock,
  runTowerEnemySetRefreshJob: runTowerEnemySetRefreshJobMock,
}));

import cronRouter from './cron.router';

function createApp() {
  return new Hono().route('/internal/cron', cronRouter);
}

describe('cron router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NODE_ENV;
  });

  it.each([
    ['/internal/cron/auction-expire', runAuctionExpireJobMock],
    ['/internal/cron/bet-battle-expire', runBetBattleExpireJobMock],
    ['/internal/cron/market-refresh', runMarketRefreshCronJobMock],
    ['/internal/cron/rank-rewards', runRankRewardsJobMock],
    [
      '/internal/cron/sect-construction-weekly',
      runSectConstructionWeeklyJobMock,
    ],
    ['/internal/cron/tower-enemy-sets', runTowerEnemySetRefreshJobMock],
    [
      '/internal/cron/player-state-events-cleanup',
      runPlayerStateEventsCleanupJobMock,
    ],
    ['/internal/cron/expired-data-cleanup', runExpiredDataCleanupJobMock],
    [
      '/internal/cron/material-library-daily-generation',
      runMaterialLibraryDailyGenerationJobMock,
    ],
  ])('rejects unauthorized requests for %s', async (path, runner) => {
    const response = await createApp().request(path);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it.each([
    [
      '/internal/cron/auction-expire',
      runAuctionExpireJobMock,
      { success: true, processed: 2, skipped: false },
    ],
    [
      '/internal/cron/bet-battle-expire',
      runBetBattleExpireJobMock,
      { success: true, processed: 1, skipped: false },
    ],
    [
      '/internal/cron/market-refresh',
      runMarketRefreshCronJobMock,
      { success: true, processed: 12, skipped: false },
    ],
    [
      '/internal/cron/rank-rewards',
      runRankRewardsJobMock,
      {
        success: true,
        processed: 100,
        skipped: false,
        settlementDate: '2026-05-15',
      },
    ],
    [
      '/internal/cron/sect-construction-weekly',
      runSectConstructionWeeklyJobMock,
      { success: true, processed: 1, skipped: false },
    ],
    [
      '/internal/cron/tower-enemy-sets',
      runTowerEnemySetRefreshJobMock,
      {
        success: true,
        processed: 7,
        skipped: false,
        generated: 7,
        failed: 0,
        logs: ['season 2026-W22@Asia/Shanghai'],
      },
    ],
    [
      '/internal/cron/player-state-events-cleanup',
      runPlayerStateEventsCleanupJobMock,
      { success: true, processed: 42, skipped: false },
    ],
    [
      '/internal/cron/expired-data-cleanup',
      runExpiredDataCleanupJobMock,
      {
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
      },
    ],
    [
      '/internal/cron/material-library-daily-generation',
      runMaterialLibraryDailyGenerationJobMock,
      { success: true, processed: 20, skipped: false },
    ],
  ])('runs %s when bearer auth is valid', async (path, runner, result) => {
    runner.mockResolvedValueOnce(result);

    const response = await createApp().request(path, {
      headers: {
        authorization: 'Bearer test-secret',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the job runner throws', async () => {
    runAuctionExpireJobMock.mockRejectedValueOnce(new Error('boom'));

    const response = await createApp().request('/internal/cron/auction-expire', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Cron job execution failed',
    });
  });

  it('returns 500 in production when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'production';

    const response = await createApp().request('/internal/cron/auction-expire');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'CRON_SECRET is required in production',
    });
    expect(runAuctionExpireJobMock).not.toHaveBeenCalled();
  });
});
