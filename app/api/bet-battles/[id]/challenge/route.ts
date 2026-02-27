import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { battleRecords } from '@/lib/drizzle/schema';
import {
  BetBattleServiceError,
  challengeBetBattle,
} from '@/lib/services/BetBattleService';
import { stream_text } from '@/utils/aiClient';
import { getBattleReportPrompt } from '@/utils/prompts';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ChallengeBetBattleSchema = z.object({
  stakeType: z.enum(['spirit_stones', 'item']),
  spiritStones: z.number().int().min(0).optional(),
  stakeItem: z
    .object({
      itemType: z.enum(['material', 'artifact', 'consumable']),
      itemId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
    .nullable()
    .optional(),
});

const statusMap: Record<string, number> = {
  INVALID_STAKE: 400,
  INVALID_REALM_RANGE: 400,
  MAX_ACTIVE_BATTLE: 400,
  BATTLE_NOT_FOUND: 404,
  BATTLE_EXPIRED: 400,
  BATTLE_NOT_PENDING: 400,
  NOT_CREATOR: 403,
  CHALLENGE_SELF: 400,
  CHALLENGER_REALM_MISMATCH: 400,
  CHALLENGER_STAKE_MISMATCH: 400,
  ITEM_NOT_FOUND: 404,
  INVALID_QUANTITY: 400,
  INSUFFICIENT_SPIRIT_STONES: 400,
  CONCURRENT_OPERATION: 429,
};

export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }, params) => {
    try {
      const body = await request.json();
      const { stakeType, spiritStones, stakeItem } =
        ChallengeBetBattleSchema.parse(body);

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

            const result = await challengeBetBattle({
              battleId: params.id,
              challengerId: cultivator.id,
              challengerName: cultivator.name,
              challengerUserId: user.id,
              stakeType,
              spiritStones,
              stakeItem,
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'battle_result',
                  data: result.battleResult,
                })}\n\n`,
              ),
            );

            const [prompt, userPrompt] = getBattleReportPrompt({
              player: result.challenger.cultivator,
              opponent: result.creator.cultivator,
              battleResult: {
                winnerId: result.battleResult.winner.id || '',
                log: result.battleResult.log ?? [],
                turns: result.battleResult.turns,
                playerHp: result.battleResult.playerHp,
                opponentHp: result.battleResult.opponentHp,
              },
            });

            let fullReport = '';
            try {
              const { textStream } = stream_text(prompt, userPrompt);
              for await (const chunk of textStream) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`,
                  ),
                );
                fullReport += chunk;
              }
            } catch (streamError) {
              console.error('Bet battle report stream failed:', streamError);
            }

            if (fullReport.trim()) {
              try {
                await getExecutor()
                  .update(battleRecords)
                  .set({ battleReport: fullReport })
                  .where(eq(battleRecords.id, result.battleRecordId));
              } catch (saveError) {
                console.error('写入赌战战报失败:', saveError);
              }
            }

            const isWin = result.winnerId === cultivator.id;
            const resultMessage = isWin
              ? '你力压对手，赢得赌战押注，奖励已发放邮件。'
              : '你此战失利，押注归对方所有，下次再战。';
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'bet_battle_settlement',
                  isWin,
                  winnerId: result.winnerId,
                  battleId: result.battleId,
                  battleRecordId: result.battleRecordId,
                  resultMessage,
                })}\n\n`,
              ),
            );

            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          } catch (error) {
            if (error instanceof BetBattleServiceError) {
              const errorData = JSON.stringify({
                type: 'error',
                error: error.message,
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
              return;
            }

            console.error('Challenge bet battle API error:', error);
            const errorMessage =
              process.env.NODE_ENV === 'development'
                ? error instanceof Error
                  ? error.message
                  : '应战失败'
                : '应战失败，请稍后重试';
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
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: '参数错误', details: error.issues },
          { status: 400 },
        );
      }

      if (error instanceof BetBattleServiceError) {
        const status = statusMap[error.code] || 400;
        return NextResponse.json({ error: error.message }, { status });
      }

      console.error('Challenge bet battle API error:', error);
      return NextResponse.json(
        { error: '应战失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
