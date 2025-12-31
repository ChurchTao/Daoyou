import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  getCultivatorRank,
  getRemainingChallenges,
  isProtected,
} from '@/lib/redis/rankings';
import { NextResponse } from 'next/server';

/**
 * GET /api/rankings/my-rank
 * 获取当前角色的排名信息、今日剩余挑战次数
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  // 获取排名
  const rank = await getCultivatorRank(cultivator.id);

  // 获取剩余挑战次数
  const remainingChallenges = await getRemainingChallenges(cultivator.id);

  // 检查是否在保护期
  const isProtectedStatus = await isProtected(cultivator.id);

  return NextResponse.json({
    success: true,
    data: {
      rank,
      remainingChallenges,
      isProtected: isProtectedStatus,
    },
  });
});
