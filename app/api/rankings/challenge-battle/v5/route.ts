import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import {
  acquireChallengeLock,
  addToRanking,
  checkDailyChallenges,
  getCultivatorRank,
  incrementDailyChallenges,
  isProtected,
  isRankingEmpty,
  releaseChallengeLock,
  updateRanking,
} from '@/lib/redis/rankings';
import { getCultivatorByIdUnsafe } from '@/lib/services/cultivatorService';
import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ChallengeBattleSchema = z.object({
  targetId: z.string().optional().nullable(),
});

/**
 * POST /api/rankings/challenge-battle/v5
 * 挑战战斗接口 v5：返回全量 BattleRecord（JSON）
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator: challenger }) => {
    let lockAcquired = false;
    let targetId: string | null = null;
    
    try {
      const body = await request.json();
      const parsed = ChallengeBattleSchema.parse(body);
      targetId = parsed.targetId || null;
      
      const cultivatorId = challenger.id;

      // 1. 检查挑战次数限制
      const challengeCheck = await checkDailyChallenges(cultivatorId);
      if (!challengeCheck.success) {
        return NextResponse.json({ error: '今日挑战次数已用完（每日限10次）' }, { status: 403 });
      }

      // 2. 检查排行榜是否为空，如果为空且挑战者不在榜上，则直接上榜
      const isEmpty = await isRankingEmpty();
      const challengerRank = await getCultivatorRank(cultivatorId);

      if ((!targetId || targetId === '') && isEmpty && challengerRank === null) {
        await addToRanking(cultivatorId, user.id, 1);
        return NextResponse.json({
          type: 'direct_entry',
          rank: 1,
          remainingChallenges: challengeCheck.remaining,
        });
      }

      if (!targetId || targetId.trim() === '') {
        return NextResponse.json({ error: '请提供被挑战者ID' }, { status: 400 });
      }

      // 3. 获取被挑战者当前排名
      const targetRank = await getCultivatorRank(targetId);
      if (targetRank === null) {
        return NextResponse.json({ error: '被挑战者不在排行榜上' }, { status: 404 });
      }

      // 4. 检查被挑战者是否在保护期
      if (await isProtected(targetId)) {
        return NextResponse.json({ error: '被挑战者处于新天骄保护期（2小时内不可挑战）' }, { status: 403 });
      }

      // 5. 获取挑战锁
      if (!(await acquireChallengeLock(targetId))) {
        return NextResponse.json({ error: '被挑战者正在被其他玩家挑战，请稍后再试' }, { status: 429 });
      }
      lockAcquired = true;

      const challengerRecord = await getCultivatorByIdUnsafe(cultivatorId);
      const targetRecord = await getCultivatorByIdUnsafe(targetId);

      if (!challengerRecord || !targetRecord) {
        return NextResponse.json({ error: '角色不存在' }, { status: 404 });
      }

      // 6. 执行战斗
      const battleResult = simulateBattleV5(challengerRecord.cultivator, targetRecord.cultivator);

      // 7. 更新排名
      const isWin = battleResult.winner.id === challenger.id;
      let newChallengerRank: number | null = challengerRank;
      let newTargetRank: number | null = targetRank;

      if (isWin) {
        if (challengerRank === null || challengerRank > targetRank) {
          await updateRanking(cultivatorId, targetId);
          newChallengerRank = await getCultivatorRank(cultivatorId);
          newTargetRank = await getCultivatorRank(targetId);
        }
      }

      // 8. 增加挑战次数
      const remainingChallenges = await incrementDailyChallenges(cultivatorId);

      // 9. 记录战斗结果（异步）
      getExecutor().insert(battleRecords).values({
        userId: user.id,
        cultivatorId,
        challengeType: 'challenge',
        opponentCultivatorId: targetId,
        battleResult,
      }).catch(e => console.error('Failed to save challenge record:', e));

      return NextResponse.json({
        type: 'battle_result',
        battleResult,
        rankingUpdate: {
          isWin,
          challengerRank: newChallengerRank,
          targetRank: newTargetRank,
          remainingChallenges,
        }
      });

    } catch (error) {
      console.error('挑战战斗流程错误:', error);
      const errorMessage = error instanceof Error ? error.message : '挑战失败';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
      if (lockAcquired && targetId) {
        await releaseChallengeLock(targetId);
      }
    }
  },
);
