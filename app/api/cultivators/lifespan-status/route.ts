import { getLifespanLimiter } from '@/lib/redis/lifespanLimiter';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 获取角色今日寿元消耗状态
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cultivatorId = searchParams.get('cultivatorId');

    if (!cultivatorId) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    const limiter = getLifespanLimiter();
    const consumed = await limiter.getConsumedLifespan(cultivatorId);
    const remaining = await limiter.getRemainingLifespan(cultivatorId);
    const isLocked = await limiter.isRetreatLocked(cultivatorId);

    return NextResponse.json({
      success: true,
      data: {
        cultivatorId,
        dailyLimit: 200,
        consumed,
        remaining,
        isInRetreat: isLocked,
      },
    });
  } catch (err) {
    console.error('查询寿元状态 API 错误:', err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'development'
            ? err instanceof Error
              ? err.message
              : '查询失败'
            : '查询失败',
      },
      { status: 500 },
    );
  }
}
