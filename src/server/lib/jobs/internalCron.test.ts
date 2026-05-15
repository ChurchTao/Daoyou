const {
  redisSet,
  redisEval,
  redisExists,
  expireListingsMock,
  expireBetBattlesMock,
  getTopRankingCultivatorIdsMock,
  sendMailMock,
} = vi.hoisted(() => ({
  redisSet: vi.fn(),
  redisEval: vi.fn(),
  redisExists: vi.fn(),
  expireListingsMock: vi.fn(),
  expireBetBattlesMock: vi.fn(),
  getTopRankingCultivatorIdsMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    set: redisSet,
    eval: redisEval,
    exists: redisExists,
  },
}));

vi.mock('@server/lib/services/AuctionService', () => ({
  expireListings: expireListingsMock,
}));

vi.mock('@server/lib/services/BetBattleService', () => ({
  expireBetBattles: expireBetBattlesMock,
}));

vi.mock('@server/lib/redis/rankings', () => ({
  getTopRankingCultivatorIds: getTopRankingCultivatorIdsMock,
}));

vi.mock('@server/lib/services/MailService', () => ({
  MailService: {
    sendMail: sendMailMock,
  },
}));

import {
  runAuctionExpireJob,
  runBetBattleExpireJob,
  runRankRewardsJob,
} from './internalCron';

describe('internal cron jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('runs auction expire under a Redis lock', async () => {
    redisSet.mockResolvedValueOnce('OK');
    expireListingsMock.mockResolvedValueOnce(3);
    redisEval.mockResolvedValueOnce(1);

    await expect(runAuctionExpireJob()).resolves.toEqual({
      success: true,
      processed: 3,
      skipped: false,
    });

    expect(redisSet).toHaveBeenCalledWith(
      'cron:auction-expire:lock',
      expect.any(String),
      'EX',
      900,
      'NX',
    );
    expect(expireListingsMock).toHaveBeenCalledTimes(1);
    expect(redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get'"),
      1,
      'cron:auction-expire:lock',
      expect.any(String),
    );
  });

  it('skips auction expire when another execution already holds the lock', async () => {
    redisSet.mockResolvedValueOnce(null);

    await expect(runAuctionExpireJob()).resolves.toEqual({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'job_in_progress',
    });

    expect(expireListingsMock).not.toHaveBeenCalled();
    expect(redisEval).not.toHaveBeenCalled();
  });

  it('skips bet battle expire when another execution already holds the lock', async () => {
    redisSet.mockResolvedValueOnce(null);

    await expect(runBetBattleExpireJob()).resolves.toEqual({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'job_in_progress',
    });

    expect(expireBetBattlesMock).not.toHaveBeenCalled();
    expect(redisEval).not.toHaveBeenCalled();
  });

  it('skips rank reward settlement when the day is already settled', async () => {
    redisSet.mockResolvedValueOnce('OK');
    redisExists.mockResolvedValueOnce(1);
    redisEval.mockResolvedValueOnce(1);

    const result = await runRankRewardsJob();

    expect(result).toMatchObject({
      success: true,
      processed: 0,
      skipped: true,
      reason: 'already_settled_today',
    });
    expect(result.settlementDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getTopRankingCultivatorIdsMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get'"),
      1,
      'golden_rank:rewards:lock',
      expect.any(String),
    );
  });
});
