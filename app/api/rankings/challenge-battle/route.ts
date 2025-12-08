import { simulateBattle } from '@/engine/battleEngine';
import { db } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import {
  acquireChallengeLock,
  checkDailyChallenges,
  getCultivatorRank,
  incrementDailyChallenges,
  isLocked,
  isProtected,
  isRankingEmpty,
  releaseChallengeLock,
  updateRanking,
} from '@/lib/redis/rankings';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { generateBattleReportStream } from '@/utils/aiClient';
import { getBattleReportPrompt } from '@/utils/prompts';
import { NextRequest } from 'next/server';

/**
 * POST /api/rankings/challenge-battle
 * 挑战战斗接口：执行挑战战斗并生成战斗播报（SSE 流式输出）
 * 在战斗结束后自动更新排名
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { cultivatorId, targetId } = body;

    // 输入验证
    if (!cultivatorId || typeof cultivatorId !== 'string') {
      return new Response(JSON.stringify({ error: '请提供有效的角色ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let lockAcquired = false;
        try {
          // 发送开始标记
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          // 1. 获取挑战者角色信息
          const challenger = await getCultivatorById(user.id, cultivatorId);
          if (!challenger) {
            throw new Error('挑战者角色不存在');
          }

          // 2. 检查挑战次数限制
          const challengeCheck = await checkDailyChallenges(cultivatorId);
          if (!challengeCheck.success) {
            throw new Error('今日挑战次数已用完（每日限10次）');
          }

          // 3. 检查排行榜是否为空，如果为空且挑战者不在榜上，则直接上榜
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
            const { addToRanking } = await import('@/lib/redis/rankings');
            await addToRanking(cultivatorId, challenger, user.id, 1);

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

          // 验证targetId类型
          if (typeof targetId !== 'string') {
            throw new Error('被挑战者ID格式错误');
          }

          // 4. 获取被挑战者当前排名
          const targetRank = await getCultivatorRank(targetId);
          if (targetRank === null) {
            throw new Error('被挑战者不在排行榜上');
          }

          // 5. 验证只能挑战排名比自己高的
          if (challengerRank !== null && challengerRank <= targetRank) {
            throw new Error('只能挑战排名比自己高的角色');
          }

          // 6. 检查被挑战者是否在保护期
          const targetProtected = await isProtected(targetId);
          if (targetProtected) {
            throw new Error('被挑战者处于新天骄保护期（2小时内不可挑战）');
          }

          // 7. 检查被挑战者是否被锁定
          const targetLocked = await isLocked(targetId);
          if (targetLocked) {
            throw new Error('被挑战者正在被其他玩家挑战，请稍后再试');
          }

          // 8. 获取挑战锁
          const lockAcquiredResult = await acquireChallengeLock(targetId);
          if (!lockAcquiredResult) {
            throw new Error('获取挑战锁失败，请稍后再试');
          }
          lockAcquired = true;

          // 9. 获取被挑战者角色信息
          const { redis } = await import('@/lib/redis/index');
          const infoKey = `golden_rank:cultivator:${targetId}`;
          // Upstash Redis: hget(key, field)
          const targetUserId = await redis.hget<string>(infoKey, 'user_id');

          if (!targetUserId) {
            throw new Error('无法获取被挑战者用户ID');
          }

          // 获取被挑战者完整信息
          const target = await getCultivatorById(targetUserId, targetId);
          if (!target) {
            throw new Error('被挑战者角色不存在');
          }

          // 10. 执行战斗
          const battleResult = simulateBattle(challenger, target);

          // 11. 发送战斗结果数据
          const battleData = JSON.stringify({
            type: 'battle_result',
            data: {
              winner: battleResult.winner,
              loser: battleResult.loser,
              log: battleResult.log,
              turns: battleResult.turns,
              playerHp: battleResult.playerHp,
              opponentHp: battleResult.opponentHp,
              timeline: battleResult.timeline,
            },
          });
          controller.enqueue(encoder.encode(`data: ${battleData}\n\n`));

          // 12. 生成战斗播报 prompt
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

          // 13. 流式生成战斗播报，并在服务端累积完整文本
          const fullReport = await generateBattleReportStream(
            prompt,
            userPrompt,
            (chunk: string) => {
              // 发送内容块
              const data = JSON.stringify({ type: 'chunk', content: chunk });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          );

          // 14. 如果挑战成功，更新排名
          const isWin = battleResult.winner.id === challenger.id;
          let newChallengerRank: number | null = challengerRank;
          let newTargetRank: number | null = targetRank;

          if (isWin) {
            await updateRanking(cultivatorId, targetId);
            newChallengerRank = await getCultivatorRank(cultivatorId);
            newTargetRank = await getCultivatorRank(targetId);
          }

          // 15. 挑战完成，增加挑战次数（无论成功或失败都消耗次数）
          const remainingChallenges =
            await incrementDailyChallenges(cultivatorId);

          // 16. 记录战斗结果
          // 为挑战者记录挑战记录
          await db.insert(battleRecords).values({
            userId: user.id,
            cultivatorId,
            challengeType: 'challenge',
            opponentCultivatorId: targetId,
            battleResult,
            battleReport: fullReport,
          });

          // 为被挑战者记录被挑战记录
          await db.insert(battleRecords).values({
            userId: targetUserId,
            cultivatorId: targetId,
            challengeType: 'challenged',
            opponentCultivatorId: cultivatorId,
            battleResult,
            battleReport: fullReport,
          });

          // 17. 发送排名更新信息
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

          // 17. 发送结束标记
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
  } catch (error) {
    console.error('挑战战斗 API 错误:', error);

    // 安全处理错误信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '挑战失败，请稍后重试'
        : '挑战失败，请稍后重试';

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
