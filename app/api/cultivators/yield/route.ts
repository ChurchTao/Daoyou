import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';
import { REALM_YIELD_RATES, RealmType } from '@/types/constants';
import { text } from '@/utils/aiClient';
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
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 10 }); // 10s lock

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

        // 4. Update DB
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
          hours: hoursElapsed,
          prevBalance: cultivator.spirit_stones,
          newBalance: cultivator.spirit_stones + amount,
        };
      });

      // 5. Generate Flavor Text via AI (Outside Transaction)
      let story = '历练归来，收获颇丰。';
      try {
        const systemPrompt =
          '你是一个修仙世界的记录者，负责记录修士在万界历练的经历。';
        const userPrompt = `
          请为一位【${result.cultivatorRealm}】境界的修士【${result.cultivatorName}】生成一段【100-200字】的历练经历。
          修士在历练中花费了【${result.hours.toFixed(1)}】小时，获得了【${result.amount}】灵石。
          
          要求：
          1. 描述修士在历练中遇到的具体事件（如探索遗迹、斩杀妖兽、奇遇、甚至是被打劫反杀等）。
          2. 必须符合修仙世界观，文风古风，有代入感。
          3. 结尾自然地提到获得了灵石。
        `;

        const aiRes = await text(systemPrompt, userPrompt);
        story = aiRes.text;
      } catch (e) {
        console.error('AI generation failed', e);
        // Fallback story if AI fails
        story = `修士在外游历${result.hours.toFixed(1)}时辰，偶遇些许机缘，虽有惊无险，但也收获灵石${result.amount}枚。`;
      }

      return NextResponse.json({
        success: true,
        data: {
          ...result,
          story,
          message: `道友此番历练 ${result.hours.toFixed(1)} 时辰，气运加身，斩获灵石 ${result.amount} 枚。`,
        },
      });
    } finally {
      // Release lock
      await redis.del(lockKey);
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
