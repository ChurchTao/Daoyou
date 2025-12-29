import { redis } from '@/lib/redis';
import { NextRequest } from 'next/server';

/**
 * 神识查探 - 获取敌人数据
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const battleId = searchParams.get('battleId');

  if (!battleId) {
    return Response.json({ error: 'Missing battleId' }, { status: 400 });
  }

  try {
    // 从 Redis 获取战斗会话数据
    const sessionData = await redis.get<{ enemyObject: unknown }>(
      `dungeon:battle:${battleId}`,
    );

    if (!sessionData) {
      return Response.json(
        { error: 'Battle session not found' },
        { status: 404 },
      );
    }

    return Response.json({
      enemy: sessionData.enemyObject,
    });
  } catch (error) {
    console.error('[probe] Error:', error);
    return Response.json({ error: 'Failed to probe enemy' }, { status: 500 });
  }
}
