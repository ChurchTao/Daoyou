import {
  addToRanking,
  checkDailyChallenges,
  getCultivatorRank,
  isLocked,
  isProtected,
  isRankingEmpty,
} from '@/lib/redis/rankings';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/rankings/challenge
 * 挑战验证接口：验证挑战条件，如果通过则返回战斗参数
 * 实际战斗在挑战战斗页面进行
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { cultivatorId, targetId } = body;

    // 输入验证
    if (!cultivatorId || typeof cultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的角色ID' },
        { status: 400 },
      );
    }

    // 1. 获取挑战者角色信息
    const challenger = await getCultivatorById(user.id, cultivatorId);
    if (!challenger) {
      return NextResponse.json({ error: '挑战者角色不存在' }, { status: 404 });
    }

    // 2. 检查挑战次数限制
    const challengeCheck = await checkDailyChallenges(cultivatorId);
    if (!challengeCheck.success) {
      return NextResponse.json(
        { error: '今日挑战次数已用完（每日限10次）' },
        { status: 400 },
      );
    }

    // 3. 检查排行榜是否为空，如果为空且挑战者不在榜上，则直接上榜
    const isEmpty = await isRankingEmpty();
    const challengerRank = await getCultivatorRank(cultivatorId);

    // 如果targetId为空或未提供，且排行榜为空，则直接上榜
    if ((!targetId || targetId === '') && isEmpty && challengerRank === null) {
      // 直接上榜，占据第一名
      await addToRanking(cultivatorId, challenger, user.id, 1);
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

    // 验证targetId类型
    if (typeof targetId !== 'string') {
      return NextResponse.json(
        { error: '被挑战者ID格式错误' },
        { status: 400 },
      );
    }

    // 4. 获取被挑战者当前排名
    const targetRank = await getCultivatorRank(targetId);
    if (targetRank === null) {
      return NextResponse.json(
        { error: '被挑战者不在排行榜上' },
        { status: 404 },
      );
    }

    // 5. 验证只能挑战排名比自己高的
    // if (challengerRank !== null && challengerRank <= targetRank) {
    //   return NextResponse.json(
    //     { error: '只能挑战排名比自己高的角色' },
    //     { status: 400 },
    //   );
    // }

    // 6. 检查被挑战者是否在保护期
    const targetProtected = await isProtected(targetId);
    if (targetProtected) {
      return NextResponse.json(
        { error: '被挑战者处于新天骄保护期（2小时内不可挑战）' },
        { status: 400 },
      );
    }

    // 7. 检查被挑战者是否被锁定
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
  } catch (error) {
    console.error('挑战验证错误:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '挑战验证失败'
        : '挑战验证失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
