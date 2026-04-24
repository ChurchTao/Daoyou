import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { BattleSession } from '@/lib/dungeon/types';
import { redis } from '@/lib/redis';
import { getCultivatorByIdUnsafe } from '@/lib/services/cultivatorService';
import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import { Cultivator } from '@/types/cultivator';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ExecuteBattleSchema = z.object({
  battleId: z.string(),
});

/**
 * POST /api/dungeon/battle/execute/v5
 * 副本战斗接口 v5：返回全量 BattleRecord（JSON）
 */
export const POST = withActiveCultivator(
  async (req: NextRequest, { cultivator }) => {
    try {
      const body = await req.json();
      const { battleId } = ExecuteBattleSchema.parse(body);
      const cultivatorId = cultivator.id;

      // Retrieve Battle Session
      const sessionKey = `dungeon:battle:${battleId}`;
      const sessionData = await redis.get<{
        session: BattleSession;
        enemyObject: Cultivator;
      }>(sessionKey);
      
      if (!sessionData) {
        return NextResponse.json({ error: '战斗会话已过期或无效' }, { status: 404 });
      }
      
      const { enemyObject } = sessionData;
      const playerBundle = await getCultivatorByIdUnsafe(cultivatorId);
      if (!playerBundle?.cultivator) {
        return NextResponse.json({ error: '玩家数据丢失' }, { status: 404 });
      }

      const playerUnit = playerBundle.cultivator;

      // Simulate Battle
      const result = simulateBattleV5(playerUnit, enemyObject, {
        hpLossPercent: sessionData.session.playerSnapshot.hpLossPercent,
        mpLossPercent: sessionData.session.playerSnapshot.mpLossPercent,
      });

      // Update Dungeon State
      let callbackResult;
      try {
        callbackResult = await dungeonService.handleBattleCallback(cultivatorId, result);
      } catch (error) {
        console.error('[dungeon/battle/v5] state update failed:', error);
        const errorMessage = error instanceof Error ? error.message : '战斗回调失败';
        callbackResult = await dungeonService.recoverAfterBattleCallbackFailure(
          cultivatorId,
          result,
          errorMessage,
        );
      }

      // Cleanup Session
      await redis.del(sessionKey);

      return NextResponse.json({
        type: 'battle_result',
        battleResult: result,
        callbackData: callbackResult.isFinished ? {
          isFinished: true,
          settlement: callbackResult.settlement,
          realGains: callbackResult.realGains,
        } : {
          isFinished: false,
          dungeonState: callbackResult.state,
          roundData: callbackResult.roundData,
        }
      });

    } catch (error) {
      console.error('Dungeon battle v5 error:', error);
      const errorMessage = error instanceof Error ? error.message : '战斗失败';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  },
);
