import { withActiveCultivator } from '@/lib/api/withAuth';
import { getLifespanLimiter } from '@/lib/redis/lifespanLimiter';
import { NextResponse } from 'next/server';

/**
 * GET /api/cultivator/lifespan-status
 * 获取当前活跃角色今日寿元消耗状态
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const limiter = getLifespanLimiter();
  const consumed = await limiter.getConsumedLifespan(cultivator.id);
  const remaining = await limiter.getRemainingLifespan(cultivator.id);
  const isLocked = await limiter.isRetreatLocked(cultivator.id);

  return NextResponse.json({
    success: true,
    data: {
      cultivatorId: cultivator.id,
      dailyLimit: 200,
      consumed,
      remaining,
      isInRetreat: isLocked,
    },
  });
});
