import { dungeonService } from '@/lib/dungeon/service_v2';
import { redis } from '@/lib/redis';
import { NextRequest } from 'next/server';

/**
 * 放弃战斗 - 触发副本结算（不受伤）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cultivatorId, battleId } = body;

    if (!cultivatorId || !battleId) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // 删除战斗会话
    await redis.del(`dungeon:battle:${battleId}`);

    // 获取副本状态
    const state = await dungeonService.getState(cultivatorId);
    if (!state) {
      return Response.json(
        { error: 'Dungeon state not found' },
        { status: 404 },
      );
    }

    // 记录放弃战斗到历史
    const lastHistory = state.history[state.history.length - 1];
    if (lastHistory) {
      lastHistory.outcome =
        '你感到此战凶险，决定不与其纠缠，转身退走。虽保全性命，却一无所获。';
    }

    // 执行结算（特殊：不添加伤势状态）
    const settlementResult = await dungeonService.settleDungeon(state, {
      skipInjury: true, // 跳过受伤逻辑
      abandonedBattle: true, // 标记为主动放弃
    });

    return Response.json({
      isFinished: true,
      settlement: settlementResult.settlement,
      state: { ...state, isFinished: true },
    });
  } catch (error) {
    console.error('[abandon] Error:', error);
    return Response.json(
      { error: 'Failed to abandon battle' },
      { status: 500 },
    );
  }
}
