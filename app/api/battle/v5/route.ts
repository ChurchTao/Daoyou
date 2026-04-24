import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { getCultivatorByIdUnsafe } from '@/lib/services/cultivatorService';
import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const BattleSchema = z.object({
  opponentId: z.string(),
});

/**
 * POST /api/battle/v5
 * 战斗接口 v5：执行战斗并返回全量 BattleRecord（JSON）
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    try {
      const body = await request.json();
      const { opponentId } = BattleSchema.parse(body);

      const playerBundle = await getCultivatorByIdUnsafe(cultivator.id);
      if (!playerBundle?.cultivator) {
        throw new Error('玩家角色不存在');
      }
      const player = playerBundle.cultivator;

      const opponentBundle = await getCultivatorByIdUnsafe(opponentId);
      if (!opponentBundle?.cultivator) {
        throw new Error('对手角色不存在');
      }
      const opponent = opponentBundle.cultivator;

      // 执行战斗引擎
      const battleResult = simulateBattleV5(player, opponent);

      // 将本次战斗结果以快照方式写入数据库（异步）
      getExecutor()
        .insert(battleRecords)
        .values({
          userId: user.id,
          cultivatorId: cultivator.id,
          battleResult,
        })
        .catch((e) => {
          console.error('写入战斗记录失败:', e);
        });

      return NextResponse.json(battleResult);
    } catch (error) {
      console.error('战斗流程错误:', error);
      const errorMessage =
        error instanceof Error ? error.message : '战斗失败';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  },
);
