import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  addToRanking,
  checkDailyChallenges,
  getCultivatorRank,
  isLocked,
  isProtected,
  isRankingEmpty,
} from '@/lib/redis/rankings';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ChallengeSchema = z.object({
  targetId: z.string().optional().nullable(),
});

/**
 * POST /api/rankings/challenge
 * 挑战验证接口：验证挑战条件，如果通过则返回战斗参数
 * 实际战斗在挑战战斗页面进行
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const body = await request.json();
    const { targetId } = ChallengeSchema.parse(body);
    const cultivatorId = cultivator.id;

    // 1. 检查挑战次数限制
    const challengeCheck = await checkDailyChallenges(cultivatorId);
    if (!challengeCheck.success) {
      return NextResponse.json(
        { error: '今日挑战次数已用完（每日限10次）' },
        { status: 400 },
      );
    }

    // 2. 检查排行榜是否为空，如果为空且挑战者不在榜上，则直接上榜
    const isEmpty = await isRankingEmpty();
    const challengerRank = await getCultivatorRank(cultivatorId);

    // 如果targetId为空或未提供，且排行榜为空，则直接上榜
    if ((!targetId || targetId === '') && isEmpty && challengerRank === null) {
      // 直接上榜，占据第一名
      await addToRanking(cultivatorId, user.id, 1);
      return NextResponse.json({
        success: true,
        message: '成功上榜，占据第一名！',
        data: {
          directEntry: true,
          rank: 1,
          remainingChallenges: challengeCheck.remaining,
        },
      });
    }

    // 如果提供了targetId，则必须进行挑战
    if (!targetId || (typeof targetId === 'string' && targetId.trim() === '')) {
      return NextResponse.json({ error: '请提供被挑战者ID' }, { status: 400 });
    }

    // 3. 获取被挑战者当前排名
    const targetRank = await getCultivatorRank(targetId);
    if (targetRank === null) {
      return NextResponse.json(
        { error: '被挑战者不在排行榜上' },
        { status: 404 },
      );
    }

    // 4. 检查被挑战者是否在保护期
    const targetProtected = await isProtected(targetId);
    if (targetProtected) {
      return NextResponse.json(
        { error: '被挑战者处于新天骄保护期（2小时内不可挑战）' },
        { status: 400 },
      );
    }

    // 5. 检查被挑战者是否被锁定
    const targetLocked = await isLocked(targetId);
    if (targetLocked) {
      return NextResponse.json(
        { error: '被挑战者正在被其他玩家挑战，请稍后再试' },
        { status: 409 },
      );
    }

    // 验证通过，返回战斗参数
    return NextResponse.json({
      success: true,
      message: '挑战验证通过，可以开始战斗',
      data: {
        cultivatorId,
        targetId,
        challengerRank,
        targetRank,
        remainingChallenges: challengeCheck.remaining,
      },
    });
  },
);
