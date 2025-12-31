import {
  checkDungeonLimit,
  getDungeonLimitConfig,
} from '@/lib/dungeon/dungeonLimiter';
import { getCultivatorByIdUnsafe } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/dungeon/limit
 * 获取当前角色的副本每日剩余次数
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 },
      );
    }

    // 2. 获取用户的活跃角色
    const cultivatorBundle = await getCultivatorByIdUnsafe(user.id);

    // 如果没有角色，返回默认限制
    if (!cultivatorBundle?.cultivator?.id) {
      const config = getDungeonLimitConfig();
      return NextResponse.json({
        success: true,
        data: {
          allowed: true,
          remaining: config.dailyLimit,
          used: 0,
          dailyLimit: config.dailyLimit,
        },
      });
    }

    // 3. 检查当前限制状态
    const limit = await checkDungeonLimit(cultivatorBundle.cultivator.id);
    const config = getDungeonLimitConfig();

    return NextResponse.json({
      success: true,
      data: {
        ...limit,
        dailyLimit: config.dailyLimit,
      },
    });
  } catch (error) {
    console.error('[Dungeon Limit API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取限制信息失败',
      },
      { status: 500 },
    );
  }
}
