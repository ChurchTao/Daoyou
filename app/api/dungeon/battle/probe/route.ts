import { withAuth } from '@/lib/api/withAuth';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 神识查探 - 获取敌人数据
 */
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const battleId = searchParams.get('battleId');

  if (!battleId) {
    return NextResponse.json({ error: 'Missing battleId' }, { status: 400 });
  }

  // 从 Redis 获取战斗会话数据
  const sessionData = await redis.get<{ enemyObject: unknown }>(
    `dungeon:battle:${battleId}`,
  );

  if (!sessionData) {
    return NextResponse.json(
      { error: 'Battle session not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    enemy: sessionData.enemyObject,
  });
});
