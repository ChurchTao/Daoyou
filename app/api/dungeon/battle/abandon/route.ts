import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const AbandonSchema = z.object({
  battleId: z.string(),
});

/**
 * 放弃战斗 - 触发副本结算（不受伤）
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { battleId } = AbandonSchema.parse(body);

    // 删除战斗会话
    await redis.del(`dungeon:battle:${battleId}`);

    // 获取副本状态
    const state = await dungeonService.getState(cultivator.id);
    if (!state) {
      return NextResponse.json(
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

    return NextResponse.json({
      isFinished: true,
      settlement: settlementResult.settlement,
      state: { ...state, isFinished: true },
    });
  },
);
