import { simulateBattle } from '@/engine/battleEngine';
import { db } from '@/lib/drizzle/db';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { BattleSession } from '@/lib/dungeon/types';
import { redis } from '@/lib/redis';
import { getCultivatorByIdUnsafe } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { Cultivator } from '@/types/cultivator';
import { stream_text } from '@/utils/aiClient';
import { getBattleReportPrompt } from '@/utils/prompts';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ... (keep imports)

const ExecuteBattleSchema = z.object({
  battleId: z.string(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get active cultivator
  const activeCultivator = await db.query.cultivators.findFirst({
    where: (cultivators, { eq, and }) =>
      and(eq(cultivators.userId, user.id), eq(cultivators.status, 'active')),
  });

  if (!activeCultivator) {
    return NextResponse.json(
      { error: 'No active cultivator' },
      { status: 404 },
    );
  }

  try {
    const body = await req.json();
    const { battleId } = ExecuteBattleSchema.parse(body);
    const cultivatorId = activeCultivator.id;

    // Retrieve Battle Session
    const sessionData = await redis.get<{
      session: BattleSession;
      enemyObject: Cultivator;
    }>(`dungeon:battle:${battleId}`);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Battle session expired or invalid' },
        { status: 404 },
      );
    }
    const { session, enemyObject } = sessionData;

    const playerBundle = await getCultivatorByIdUnsafe(cultivatorId);

    if (!playerBundle?.cultivator) throw new Error('Player data missing');

    const playerUnit = playerBundle.cultivator;
    const enemyUnit = enemyObject;

    // Simulate Battle
    const result = simulateBattle(playerUnit, enemyUnit, {
      hp: session.playerSnapshot.currentHp,
      mp: session.playerSnapshot.currentMp,
    });

    // Stream Response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send Start Marker
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

          // 1. Send Result immediately (for timeline)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'battle_result', data: result })}\n\n`,
            ),
          );

          // 2. Stream AI Report
          const [systemPrompt, userPrompt] = getBattleReportPrompt({
            player: playerUnit,
            opponent: enemyUnit,
            battleResult: {
              log: result.log,
              turns: result.turns,
              playerHp: result.playerHp,
              opponentHp: result.opponentHp,
              winnerId: result.winner.id || result.winner.name,
            },
          });

          // 3. Update Dungeon State (Concurrent)
          // Start the state update promise BEFORE streaming text
          const stateUpdatePromise = dungeonService.handleBattleCallback(
            cultivatorId,
            result,
          );

          const { textStream: reportStream } = stream_text(
            systemPrompt,
            userPrompt,
            true, // fast model
            false, // thinking
          );

          for await (const chunk of reportStream) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`,
              ),
            );
          }

          // Await the state update after streaming is done
          const callbackResult = await stateUpdatePromise;

          if ((callbackResult as any).isFinished) {
            const finished = callbackResult as any;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'done',
                  isFinished: true,
                  settlement: finished.settlement,
                })}\n\n`,
              ),
            );
          } else {
            const active = callbackResult as any;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'done',
                  dungeonState: active.state,
                  roundData: active.roundData,
                  isFinished: false,
                })}\n\n`,
              ),
            );
          }
          controller.close();
        } catch (error) {
          console.error('Battle streaming error:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Streaming failed';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`,
            ),
          );
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
    console.error('Battle Execute Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'System Error' },
      { status: 500 },
    );
  }
}
