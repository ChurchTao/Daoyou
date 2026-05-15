const {
  runAuctionExpireJobMock,
  runBetBattleExpireJobMock,
  runRankRewardsJobMock,
} = vi.hoisted(() => ({
  runAuctionExpireJobMock: vi.fn(),
  runBetBattleExpireJobMock: vi.fn(),
  runRankRewardsJobMock: vi.fn(),
}));

vi.mock('./internalCron', () => ({
  runAuctionExpireJob: runAuctionExpireJobMock,
  runBetBattleExpireJob: runBetBattleExpireJobMock,
  runRankRewardsJob: runRankRewardsJobMock,
}));

describe('internal cron scheduler', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers the three Bun cron jobs once in production mode', async () => {
    const bunCron = vi.fn(() => ({ stop: vi.fn() }));
    const { registerInternalCronJobs } = await import('./internalCronScheduler');

    const firstRegistration = registerInternalCronJobs({
      bunCron,
      enabled: true,
    });
    const secondRegistration = registerInternalCronJobs({
      bunCron,
      enabled: true,
    });

    expect(bunCron).toHaveBeenCalledTimes(3);
    expect(bunCron).toHaveBeenNthCalledWith(1, '*/2 * * * *', expect.any(Function));
    expect(bunCron).toHaveBeenNthCalledWith(2, '*/2 * * * *', expect.any(Function));
    expect(bunCron).toHaveBeenNthCalledWith(3, '0 16 * * *', expect.any(Function));
    expect(secondRegistration).toBe(firstRegistration);
  });

  it('does not register cron jobs when disabled', async () => {
    const bunCron = vi.fn(() => ({ stop: vi.fn() }));
    const { registerInternalCronJobs } = await import('./internalCronScheduler');

    const tasks = registerInternalCronJobs({
      bunCron,
      enabled: false,
    });

    expect(bunCron).not.toHaveBeenCalled();
    expect(tasks).toEqual([]);
  });
});
