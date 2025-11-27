import { NextRequest } from 'next/server';
import { generateBattleReportStream } from '../../../utils/aiClient';
import { getBattleReportPrompt } from '../../../utils/prompts';
import type { Cultivator } from '../../../types/cultivator';

/**
 * POST /api/generate-battle-report
 * 生成战斗播报（SSE 流式输出）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player, opponent, battleSummary } = body;

    if (!player || !opponent || !battleSummary || !Array.isArray(battleSummary.log)) {
      return new Response(
        JSON.stringify({ error: '请提供完整的角色与战斗日志信息' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证角色数据
    const playerCultivator = player as Cultivator;
    const opponentCultivator = opponent as Cultivator;

    // 生成战斗播报 prompt
    const [prompt, userPrompt] = getBattleReportPrompt({
      player: playerCultivator,
      opponent: opponentCultivator,
      battleResult: {
        winnerId: battleSummary.winnerId,
        log: battleSummary.log ?? [],
        turns: battleSummary.turns,
        playerHp: battleSummary.playerHp,
        opponentHp: battleSummary.opponentHp,
        triggeredMiracle: battleSummary.triggeredMiracle,
      },
    });

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始标记
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          // 调用流式生成函数
          await generateBattleReportStream(prompt, userPrompt, (chunk: string) => {
            // 发送内容块
            const data = JSON.stringify({ type: 'chunk', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          });

          // 发送结束标记
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        } catch (error) {
          console.error('生成战斗播报流式输出错误:', error);
          const errorMessage = error instanceof Error 
            ? error.message 
            : '生成战斗播报失败';
          const errorData = JSON.stringify({ type: 'error', error: errorMessage });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('生成战斗播报 API 错误:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : '生成战斗播报失败，请稍后重试';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
