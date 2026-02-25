import { getTopRankingCultivatorIds } from '@/lib/redis/rankings';
import { redis } from '@/lib/redis';
import { MailService } from '@/lib/services/MailService';
import { RANKING_REWARDS } from '@/types/constants';
import { NextResponse } from 'next/server';

const REWARD_LOCK_KEY = 'golden_rank:rewards:lock';
const REWARD_SETTLED_PREFIX = 'golden_rank:rewards:settled:';
const LOCK_TTL_SECONDS = 15 * 60;
const SETTLED_TTL_SECONDS = 7 * 24 * 60 * 60;

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

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const lockResult = await redis.set(REWARD_LOCK_KEY, Date.now().toString(), {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    });
    if (lockResult !== 'OK') {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'settlement_in_progress',
      });
    }

    const settlementDate = getSettlementDateCN();
    const settledKey = `${REWARD_SETTLED_PREFIX}${settlementDate}`;
    const alreadySettled = await redis.exists(settledKey);
    if (alreadySettled === 1) {
      return NextResponse.json({
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

    await redis.setex(settledKey, SETTLED_TTL_SECONDS, Date.now().toString());

    return NextResponse.json({
      success: true,
      settlementDate,
      processed: topCultivatorIds.length,
      logs,
    });
  } catch (error) {
    console.error('Rank rewards error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to settle rewards' },
      { status: 500 },
    );
  } finally {
    await redis.del(REWARD_LOCK_KEY);
  }
}
