import {
  getCultivatorRank,
  getCultivatorRankInfo,
  getRemainingChallenges,
  isProtected,
} from '@/lib/redis/rankings';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/rankings/my-rank
 * 获取当前角色的排名信息、今日剩余挑战次数
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const cultivatorId = searchParams.get('cultivatorId');

    if (!cultivatorId) {
      return NextResponse.json(
        { error: '请提供角色ID' },
        { status: 400 },
      );
    }

    // 获取排名
    const rank = await getCultivatorRank(cultivatorId);

    // 获取角色详细信息
    const rankInfo = await getCultivatorRankInfo(cultivatorId);

    // 获取剩余挑战次数
    const remainingChallenges = await getRemainingChallenges(cultivatorId);

    // 检查是否在保护期
    const isProtectedStatus = await isProtected(cultivatorId);

    return NextResponse.json({
      success: true,
      data: {
        rank,
        rankInfo,
        remainingChallenges,
        isProtected: isProtectedStatus,
      },
    });
  } catch (error) {
    console.error('获取我的排名 API 错误:', error);

    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取排名信息失败，请稍后重试'
        : '获取排名信息失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

