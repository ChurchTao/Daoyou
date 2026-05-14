import { redis } from '@server/lib/redis';
import { expireListings } from '@server/lib/services/AuctionService';
import { expireBetBattles } from '@server/lib/services/BetBattleService';
import { MailService } from '@server/lib/services/MailService';
import { getTopRankingCultivatorIds } from '@server/lib/redis/rankings';
import type { AppEnv } from '@server/lib/hono/types';
import { RANKING_REWARDS } from '@shared/types/constants';
import { Hono } from 'hono';

const REWARD_LOCK_KEY = 'golden_rank:rewards:lock';
const REWARD_SETTLED_PREFIX = 'golden_rank:rewards:settled:';
const LOCK_TTL_SECONDS = 15 * 60;
const SETTLED_TTL_SECONDS = 7 * 24 * 60 * 60;

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return true;
  }

  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

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

const router = new Hono<AppEnv>();

router.get('/auction-expire', async (c) => {
  if (!isAuthorizedCronRequest(c.req.raw)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const processed = await expireListings();
    console.log(`Processed ${processed} expired auctions`);

    return c.json({
      success: true,
      processed,
      message: `已处理 ${processed} 个过期拍卖`,
    });
  } catch (error) {
    console.error('Auction Expire Cron Error:', error);
    return c.json({ success: false, error: '处理过期拍卖失败' }, 500);
  }
});

router.get('/bet-battle-expire', async (c) => {
  if (!isAuthorizedCronRequest(c.req.raw)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const processed = await expireBetBattles();
    return c.json({
      success: true,
      processed,
      message: `已处理 ${processed} 个过期赌战`,
    });
  } catch (error) {
    console.error('Bet battle expire cron error:', error);
    return c.json({ success: false, error: '处理过期赌战失败' }, 500);
  }
});

router.get('/rank-rewards', async (c) => {
  if (!isAuthorizedCronRequest(c.req.raw)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const lockResult = await redis.set(
      REWARD_LOCK_KEY,
      Date.now().toString(),
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );

    if (lockResult !== 'OK') {
      return c.json({
        success: true,
        skipped: true,
        reason: 'settlement_in_progress',
      });
    }

    const settlementDate = getSettlementDateCN();
    const settledKey = `${REWARD_SETTLED_PREFIX}${settlementDate}`;
    const alreadySettled = await redis.exists(settledKey);

    if (alreadySettled > 0) {
      return c.json({
        success: true,
        skipped: true,
        reason: 'already_settled_today',
        settlementDate,
      });
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

    return c.json({
      success: true,
      settlementDate,
      processed: topCultivatorIds.length,
      logs,
    });
  } catch (error) {
    console.error('Rank rewards error:', error);
    return c.json({ success: false, error: 'Failed to settle rewards' }, 500);
  } finally {
    await redis.del(REWARD_LOCK_KEY);
  }
});

export default router;
