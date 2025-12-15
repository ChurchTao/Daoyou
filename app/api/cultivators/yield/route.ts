import { db } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { cultivators } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';
import { REALM_YIELD_RATES, RealmType } from '@/types/constants';
import { stream_text } from '@/utils/aiClient';
import {
  GeneratedMaterial,
  generateRandomMaterials,
} from '@/utils/materialGenerator';
import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '道友神识未至，请先入定（登录）。' },
        { status: 401 },
      );
    }

    const { cultivatorId } = await req.json();

    if (!cultivatorId) {
      return NextResponse.json(
        { success: false, error: '天机混沌，无法锁定道友方位。' },
        { status: 400 },
      );
    }

    // Prevent concurrent claims with Redis lock
    const lockKey = `yield:lock:${cultivatorId}`;
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 100 }); // 10s lock

    if (!acquired) {
      return NextResponse.json(
        { success: false, error: '道友请勿心急，机缘正在结算中...' },
        { status: 429 },
      );
    }

    try {
      // Wrap in transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // 1. Fetch Cultivator
        const [cultivator] = await tx
          .select()
          .from(cultivators)
          .where(eq(cultivators.id, cultivatorId))
          .limit(1);

        if (!cultivator) {
          throw new Error('三界之中未寻得此道友踪迹。');
        }

        if (cultivator.userId !== user.id) {
          throw new Error('道友莫要妄图染指他人因果。');
        }

        // 2. Calculate time elapsed
        const lastYieldAt = cultivator.last_yield_at
          ? new Date(cultivator.last_yield_at)
          : new Date(cultivator.createdAt || Date.now());
        const now = new Date();
        const diffMs = now.getTime() - lastYieldAt.getTime();
        const hoursElapsed = Math.min(diffMs / (1000 * 60 * 60), 24); // Cap at 24 hours

        if (hoursElapsed < 1) {
          throw new Error('历练时日尚短（不足一小时），难有机缘。');
        }

        // 3. Calculate Yield
        const realm = cultivator.realm as RealmType;
        const baseRate = REALM_YIELD_RATES[realm] || 10;
        const randomMultiplier = 0.8 + Math.random() * (2 - 0.8); // 0.8 ~ 2.0
        const amount = Math.floor(baseRate * hoursElapsed * randomMultiplier);

        // 4. Calculate Material Drops
        const materialCount = Math.floor(hoursElapsed / 3);
        let gainedMaterials: GeneratedMaterial[] = [];

        if (materialCount > 0) {
          gainedMaterials = await generateRandomMaterials(materialCount);

          if (gainedMaterials.length > 0) {
            await tx.insert(schema.materials).values(
              gainedMaterials.map((m) => ({
                id: crypto.randomUUID(),
                cultivatorId: cultivatorId,
                name: m.name,
                type: m.type,
                rank: m.rank, // Corrected from quality to rank
                description: m.description,
                element: m.element,
                quantity: m.quantity,
                price: m.price,
              })),
            );
          }
        }

        // 5. Update DB
        await tx
          .update(cultivators)
          .set({
            spirit_stones: sql`${cultivators.spirit_stones} + ${amount}`,
            last_yield_at: now,
          })
          .where(eq(cultivators.id, cultivatorId));

        return {
          cultivatorName: cultivator.name,
          cultivatorRealm: cultivator.realm,
          amount,
          materials: gainedMaterials,
          hours: hoursElapsed,
          prevBalance: cultivator.spirit_stones,
          newBalance: cultivator.spirit_stones + amount,
        };
      });

      // 6. Generate Flavor Text via SSE
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            // First send the calculation result
            const initialData = JSON.stringify({
              type: 'result',
              data: {
                ...result,
              },
            });
            controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

            const systemPrompt =
              '你是一个修仙世界的记录者，负责记录修士外出历练的经历。';
            const userPrompt = `
                  请为一位【${result.cultivatorRealm}】境界的修士【${result.cultivatorName}】生成一段【100-200字】的历练经历。
                  修士在历练中花费了【${result.hours.toFixed(1)}】小时。
                  
                  收获如下：
                  1. 灵石：【${result.amount}】枚。
                  ${
                    result.materials.length > 0
                      ? `2. 获得材料：${result.materials.map((m) => `【${m.rank}】${m.name}`).join('、')}。`
                      : ''
                  }
                  
                  要求：
                  1. 描述修士在历练中遇到的具体事件（如探索遗迹、斩杀妖兽、奇遇等），并巧妙地将获得灵石和材料的过程融入故事中。
                  2. 必须符合修仙世界观，文风古风，有代入感。
                  3. 若获得了稀有材料（玄品以上），请着重描写其获取的不易或机缘巧合。
                `;

            // Stream AI generation
            const aiStreamResult = stream_text(systemPrompt, userPrompt, true);
            for await (const chunk of aiStreamResult.textStream) {
              const msg = JSON.stringify({ type: 'chunk', text: chunk });
              controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
            }
          } catch (e) {
            console.error('Stream processing error:', e);
            const errorMsg = JSON.stringify({
              type: 'error',
              error: '天机推演中断...',
            });
            controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
          } finally {
            controller.close();
            // Release lock when stream ends
            await redis.del(lockKey);
          }
        },
      });

      return new NextResponse(customStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (e) {
      // If error happens before stream creation, release lock here
      await redis.del(lockKey);
      throw e;
    }
  } catch (error) {
    console.error('Yield API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 },
    );
  }
}
