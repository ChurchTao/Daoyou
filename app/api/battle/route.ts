import { simulateBattle } from '@/engine/battle';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { getCultivatorByIdUnsafe } from '@/lib/repositories/cultivatorRepository';
import { stream_text } from '@/utils/aiClient';
import { getBattleReportPrompt } from '@/utils/prompts';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const BattleSchema = z.object({
  opponentId: z.string(),
});

/**
 * POST /api/battle
 * 合并的战斗接口：执行战斗并生成战斗播报（SSE 流式输出）
 * 接收对手ID，直接返回战斗结果和播报
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const body = await request.json();
    const { opponentId } = BattleSchema.parse(body);

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始标记
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          const playerBundle = await getCultivatorByIdUnsafe(cultivator.id);
          if (!playerBundle?.cultivator) {
            throw new Error('玩家角色不存在');
          }
          const player = playerBundle.cultivator;

          // 1. 获取对手角色信息
          const opponentBundle = await getCultivatorByIdUnsafe(opponentId);
          if (!opponentBundle?.cultivator) {
            throw new Error('对手角色不存在');
          }
          const opponent = opponentBundle.cultivator;

          // 2. 执行战斗引擎
          const battleResult = simulateBattle(player, opponent);

          // 3. 发送战斗结果数据
          const battleData = JSON.stringify({
            type: 'battle_result',
            data: battleResult,
          });
          controller.enqueue(encoder.encode(`data: ${battleData}\n\n`));

          // 4. 生成战斗播报 prompt
          const [prompt, userPrompt] = getBattleReportPrompt({
            player,
            opponent,
            battleResult: {
              winnerId: battleResult.winner.id || '',
              log: battleResult.log ?? [],
              turns: battleResult.turns,
              playerHp: battleResult.playerHp,
              opponentHp: battleResult.opponentHp,
            },
          });

          // 5. 流式生成战斗播报，并在服务端累积完整文本
          let fullReport = '';
          const { textStream } = stream_text(prompt, userPrompt);
          for await (const chunk of textStream) {
            // 发送内容块
            const data = JSON.stringify({ type: 'chunk', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            fullReport += chunk;
          }

          // 6. 将本次战斗结果以快照方式写入数据库
          try {
            await getExecutor().insert(battleRecords).values({
              userId: user.id,
              cultivatorId: cultivator.id,
              battleResult,
              battleReport: fullReport,
            });
          } catch (e) {
            // 写入战斗记录失败不应影响前端体验，仅记录日志
            console.error('写入战斗记录失败:', e);
          }

          // 7. 发送结束标记
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        } catch (error) {
          console.error('战斗流程错误:', error);
          // 安全处理错误信息
          const errorMessage =
            process.env.NODE_ENV === 'development'
              ? error instanceof Error
                ? error.message
                : '战斗失败'
              : '战斗失败';
          const errorData = JSON.stringify({
            type: 'error',
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
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
