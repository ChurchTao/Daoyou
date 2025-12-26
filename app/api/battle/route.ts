import { simulateBattle } from '@/engine/battle';
import { db } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { stream_text } from '@/utils/aiClient';
import { getBattleReportPrompt } from '@/utils/prompts';
import { NextRequest } from 'next/server';

/**
 * POST /api/battle
 * 合并的战斗接口：执行战斗并生成战斗播报（SSE 流式输出）
 * 接收角色ID和敌人ID，直接返回战斗结果和播报
 */
export async function POST(request: NextRequest) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前用户，验证用户身份
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
    const { cultivatorId, opponentId } = body;

    // 输入验证
    if (
      !cultivatorId ||
      typeof cultivatorId !== 'string' ||
      !opponentId ||
      typeof opponentId !== 'string'
    ) {
      return new Response(
        JSON.stringify({ error: '请提供有效的角色ID和对手ID' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始标记
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          // 1. 获取玩家角色信息
          const player = await getCultivatorById(user.id, cultivatorId);
          if (!player) {
            throw new Error('玩家角色不存在');
          }

          // 2. 获取对手角色信息
          const opponent = await getCultivatorById(user.id, opponentId);
          if (!opponent) {
            throw new Error('对手角色不存在');
          }

          // 3. 执行战斗引擎
          const battleResult = simulateBattle(player, opponent);

          // 4. 发送战斗结果数据
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

          // 5. 生成战斗播报 prompt
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

          // 6. 流式生成战斗播报，并在服务端累积完整文本
          let fullReport = '';
          const { textStream } = stream_text(prompt, userPrompt);
          for await (const chunk of textStream) {
            // 发送内容块
            const data = JSON.stringify({ type: 'chunk', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            fullReport += chunk;
          }

          // 7. 将本次战斗结果以快照方式写入数据库
          try {
            await db.insert(battleRecords).values({
              userId: user.id,
              cultivatorId,
              battleResult,
              battleReport: fullReport,
            });
          } catch (e) {
            // 写入战斗记录失败不应影响前端体验，仅记录日志
            console.error('写入战斗记录失败:', e);
          }

          // 8. 发送结束标记
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
  } catch (error) {
    console.error('战斗 API 错误:', error);

    // 安全处理错误信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '战斗失败，请稍后重试'
        : '战斗失败，请稍后重试';

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
