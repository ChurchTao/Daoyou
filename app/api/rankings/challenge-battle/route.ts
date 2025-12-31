import { simulateBattle } from '@/engine/battle';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
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
import { getCultivatorByIdUnsafe } from '@/lib/repositories/cultivatorRepository';
import { stream_text } from '@/utils/aiClient';
import { getBattleReportPrompt } from '@/utils/prompts';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ChallengeBattleSchema = z.object({
  targetId: z.string().optional(),
});

/**
 * POST /api/rankings/challenge-battle
 * 挑战战斗接口：执行挑战战斗并生成战斗播报（SSE 流式输出）
 * 在战斗结束后自动更新排名
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator: challenger }) => {
    const body = await request.json();
    const { targetId } = ChallengeBattleSchema.parse(body);
    const cultivatorId = challenger.id;

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let lockAcquired = false;
        try {
          // 发送开始标记
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          // 1. 检查挑战次数限制
          const challengeCheck = await checkDailyChallenges(cultivatorId);
          if (!challengeCheck.success) {
            throw new Error('今日挑战次数已用完（每日限10次）');
          }

          // 2. 检查排行榜是否为空，如果为空且挑战者不在榜上，则直接上榜
          const isEmpty = await isRankingEmpty();
          const challengerRank = await getCultivatorRank(cultivatorId);

          // 如果targetId为空或未提供，且排行榜为空，则直接上榜
          // 注意：直接上榜不消耗挑战次数
          if (
            (!targetId || targetId === '') &&
            isEmpty &&
            challengerRank === null
          ) {
            // 直接上榜，占据第一名
            await addToRanking(cultivatorId, user.id, 1);

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'direct_entry',
                  message: '成功上榜，占据第一名！',
                  rank: 1,
                  remainingChallenges: challengeCheck.remaining, // 直接上榜不消耗次数
                })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
            return;
          }

          // 如果提供了targetId，则必须进行挑战
          if (
            !targetId ||
            (typeof targetId === 'string' && targetId.trim() === '')
          ) {
            throw new Error('请提供被挑战者ID');
          }

          // 3. 获取被挑战者当前排名
          const targetRank = await getCultivatorRank(targetId);
          if (targetRank === null) {
            throw new Error('被挑战者不在排行榜上');
          }

          // 4. 检查被挑战者是否在保护期
          const targetProtected = await isProtected(targetId);
          if (targetProtected) {
            throw new Error('被挑战者处于新天骄保护期（2小时内不可挑战）');
          }

          // 5. 获取挑战锁
          const lockAcquiredResult = await acquireChallengeLock(targetId);
          if (!lockAcquiredResult) {
            throw new Error('被挑战者正在被其他玩家挑战，请稍后再试');
          }
          lockAcquired = true;

          const challengerRecord = await getCultivatorByIdUnsafe(cultivatorId);
          if (!challengerRecord) {
            throw new Error('挑战者角色不存在');
          }
          const challenger = challengerRecord.cultivator;

          // 6. 获取被挑战者完整信息（回表）
          const targetRecord = await getCultivatorByIdUnsafe(targetId);
          if (!targetRecord) {
            throw new Error('被挑战者角色不存在');
          }
          const target = targetRecord.cultivator;

          // 7. 执行战斗
          const battleResult = simulateBattle(challenger, target);

          // 8. 发送战斗结果数据
          const battleData = JSON.stringify({
            type: 'battle_result',
            data: battleResult,
          });
          controller.enqueue(encoder.encode(`data: ${battleData}\n\n`));

          // 9. 生成战斗播报 prompt
          const [prompt, userPrompt] = getBattleReportPrompt({
            player: challenger,
            opponent: target,
            battleResult: {
              winnerId: battleResult.winner.id || '',
              log: battleResult.log ?? [],
              turns: battleResult.turns,
              playerHp: battleResult.playerHp,
              opponentHp: battleResult.opponentHp,
            },
          });

          // 10. 流式生成战斗播报，并在服务端累积完整文本
          let fullReport = '';
          const { textStream } = stream_text(prompt, userPrompt);
          for await (const chunk of textStream) {
            // 发送内容块
            const data = JSON.stringify({ type: 'chunk', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            fullReport += chunk;
          }

          // 11. 如果挑战成功，更新排名
          const isWin = battleResult.winner.id === challenger.id;
          let newChallengerRank: number | null = challengerRank;
          let newTargetRank: number | null = targetRank;

          if (isWin) {
            // 只有当挑战者排名比对方低（数字大），或者挑战者未上榜时，才互换名次
            // 如果挑战者排名比对方高（数字小），说明是向下挑战（切磋），不改变名次
            if (challengerRank === null || challengerRank > targetRank) {
              await updateRanking(cultivatorId, targetId);
              newChallengerRank = await getCultivatorRank(cultivatorId);
              newTargetRank = await getCultivatorRank(targetId);
            }
          }

          // 12. 挑战完成，增加挑战次数（无论成功或失败都消耗次数）
          const remainingChallenges =
            await incrementDailyChallenges(cultivatorId);

          // 13. 记录战斗结果
          // 为挑战者记录挑战记录
          await db.insert(battleRecords).values({
            userId: user.id,
            cultivatorId,
            challengeType: 'challenge',
            opponentCultivatorId: targetId,
            battleResult,
            battleReport: fullReport,
          });

          // 14. 发送排名更新信息
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'ranking_update',
                isWin,
                challengerRank: newChallengerRank,
                targetRank: newTargetRank,
                remainingChallenges,
              })}\n\n`,
            ),
          );

          // 15. 发送结束标记
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        } catch (error) {
          console.error('挑战战斗流程错误:', error);
          // 安全处理错误信息
          const errorMessage =
            process.env.NODE_ENV === 'development'
              ? error instanceof Error
                ? error.message
                : '挑战失败'
              : '挑战失败';
          const errorData = JSON.stringify({
            type: 'error',
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        } finally {
          // 释放锁
          if (lockAcquired && targetId) {
            await releaseChallengeLock(targetId);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  },
);
