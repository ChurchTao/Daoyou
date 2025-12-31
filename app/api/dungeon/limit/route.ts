import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  checkDungeonLimit,
  getDungeonLimitConfig,
} from '@/lib/dungeon/dungeonLimiter';
import { NextResponse } from 'next/server';

/**
 * GET /api/dungeon/limit
 * 获取当前角色的副本每日剩余次数
 */
export const GET = withActiveCultivator(async (_req, { cultivator }) => {
  const limit = await checkDungeonLimit(cultivator.id);
  const config = getDungeonLimitConfig();

  return NextResponse.json({
    success: true,
    data: {
      ...limit,
      dailyLimit: config.dailyLimit,
    },
  });
});
