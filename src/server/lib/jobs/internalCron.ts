import { randomUUID } from 'node:crypto';
import { redis } from '@server/lib/redis';
import { getTopRankingCultivatorIds } from '@server/lib/redis/rankings';
import { expireListings } from '@server/lib/services/AuctionService';
import { expireBetBattles } from '@server/lib/services/BetBattleService';
import { MailService } from '@server/lib/services/MailService';
import { RANKING_REWARDS } from '@shared/types/constants';

const AUCTION_EXPIRE_LOCK_KEY = 'cron:auction-expire:lock';
const BET_BATTLE_EXPIRE_LOCK_KEY = 'cron:bet-battle-expire:lock';
const RANK_REWARD_LOCK_KEY = 'golden_rank:rewards:lock';
const RANK_REWARD_SETTLED_PREFIX = 'golden_rank:rewards:settled:';
const LOCK_TTL_SECONDS = 15 * 60;
const SETTLED_TTL_SECONDS = 7 * 24 * 60 * 60;

export type CronJobResult = {
  success: true;
  processed: number;
  skipped: boolean;
  reason?: string;
};

export type RankRewardsJobResult = CronJobResult & {
  settlementDate?: string;
  logs?: string[];
};

function getRewardByRank(rank: number): number {
  if (rank === 1) return RANKING_REWARDS[1];
  if (rank === 2) return RANKING_REWARDS[2];
  if (rank === 3) return RANKING_REWARDS[3];
  if (rank <= 10) return RANKING_REWARDS['4-10'];
  if (rank <= 50) return RANKING_REWARDS['11-50'];
  return RANKING_REWARDS['51-100'];
}

function getSettlementDateCN(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

async function releaseJobLock(lockKey: string, lockToken: string): Promise<void> {
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    lockKey,
    lockToken,
  );
}

async function withJobLock<T extends CronJobResult>(
  jobName: string,
  lockKey: string,
  run: () => Promise<T>,
): Promise<T | CronJobResult> {
  const startedAt = Date.now();
  const lockToken = randomUUID();

  console.info(`[cron] ${jobName} started`);

  const lockResult = await redis.set(
    lockKey,
    lockToken,
    'EX',
    LOCK_TTL_SECONDS,
    'NX',
  );

  if (lockResult !== 'OK') {
    const result: CronJobResult = {
      success: true,
      processed: 0,
      skipped: true,
      reason: 'job_in_progress',
    };
    console.info(`[cron] ${jobName} skipped`, {
      reason: result.reason,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }

  try {
    const result = await run();
    console.info(`[cron] ${jobName} finished`, {
      processed: result.processed,
      skipped: result.skipped,
      reason: result.reason,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    console.error(
      `[cron] ${jobName} failed after ${Date.now() - startedAt}ms`,
      error,
    );
    throw error;
  } finally {
    await releaseJobLock(lockKey, lockToken);
  }
}

export async function runAuctionExpireJob(): Promise<CronJobResult> {
  return withJobLock('auction-expire', AUCTION_EXPIRE_LOCK_KEY, async () => {
    const processed = await expireListings();
    return {
      success: true,
      processed,
      skipped: false,
    };
  });
}

export async function runBetBattleExpireJob(): Promise<CronJobResult> {
  return withJobLock('bet-battle-expire', BET_BATTLE_EXPIRE_LOCK_KEY, async () => {
    const processed = await expireBetBattles();
    return {
      success: true,
      processed,
      skipped: false,
    };
  });
}

export async function runRankRewardsJob(): Promise<RankRewardsJobResult> {
  return withJobLock('rank-rewards', RANK_REWARD_LOCK_KEY, async () => {
    const settlementDate = getSettlementDateCN();
    const settledKey = `${RANK_REWARD_SETTLED_PREFIX}${settlementDate}`;
    const alreadySettled = await redis.exists(settledKey);

    if (alreadySettled > 0) {
      return {
        success: true,
        processed: 0,
        skipped: true,
        reason: 'already_settled_today',
        settlementDate,
      };
    }

    const topCultivatorIds = await getTopRankingCultivatorIds(100);
    const logs: string[] = [];

    for (let i = 0; i < topCultivatorIds.length; i++) {
      const rank = i + 1;
      const reward = getRewardByRank(rank);

      await MailService.sendMail(
        topCultivatorIds[i],
        '万界金榜结算奖励',
        `恭喜你在本期万界金榜中位列第${rank}名，奖励已随邮件发放，请及时领取。`,
        [{ type: 'spirit_stones', name: '灵石', quantity: reward }],
        'reward',
      );

      logs.push(`Rank ${rank}: +${reward}`);
    }

    await redis.set(settledKey, Date.now().toString(), 'EX', SETTLED_TTL_SECONDS);

    return {
      success: true,
      settlementDate,
      processed: topCultivatorIds.length,
      skipped: false,
      logs,
    };
  });
}
