import { db } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';
import { Material } from '@/types/cultivator';
import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

const MARKET_CACHE_KEY = 'market:listings';
const BUY_LOCK_PREFIX = 'market:buy:lock:';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cultivatorId, itemId, quantity = 1 } = body;

    // 1. Validate Input
    if (!cultivatorId || !itemId) {
      return NextResponse.json(
        { error: '参数缺失 (Missing parameters)' },
        { status: 400 },
      );
    }

    // 2. Acquire Lock (防止并发购买同一物品)
    const lockKey = `${BUY_LOCK_PREFIX}${itemId}`;
    const acquiredLock = await redis.set(lockKey, 'locked', {
      nx: true,
      ex: 10, // 10秒自动过期
    });

    if (!acquiredLock) {
      return NextResponse.json(
        { error: '此物正被其他道友争夺，请稍后再试' },
        { status: 429 },
      );
    }

    try {
      // 3. Fetch Market Listings
      const listings: Material[] | null = await redis.get(MARKET_CACHE_KEY);
      if (!listings) {
        return NextResponse.json(
          { error: '坊市正在进货中，暂未开启' },
          { status: 404 },
        );
      }

      // 4. Find Item
      const itemIndex = listings.findIndex((i: Material) => i.id === itemId);
      if (itemIndex === -1) {
        return NextResponse.json(
          { error: '此物已不再坊市之中，或许已被他人买走' },
          { status: 404 },
        );
      }

      const item = listings[itemIndex];
      // Check stock again safely
      if (item.quantity < quantity) {
        return NextResponse.json(
          { error: '坊市库存不足，请减少购买数量' },
          { status: 400 },
        );
      }

      const totalPrice = (item.price || 0) * quantity;

      // 5. Transaction: Deduct Money & Add Material
      await db.transaction(async (tx) => {
        // 5.1 Check & Deduct Funds (Atomic check via WHERE clause)
        // 这种写法防止先读后写的并发竞态条件，只有余额足够时才会更新成功
        const [updatedCultivator] = await tx
          .update(cultivators)
          .set({
            spirit_stones: sql`${cultivators.spirit_stones} - ${totalPrice}`,
          })
          .where(
            // 必须满足: ID匹配 且 余额 >= 总价
            sql`${cultivators.id} = ${cultivatorId} AND ${cultivators.spirit_stones} >= ${totalPrice}`,
          )
          .returning({
            id: cultivators.id,
            spirit_stones: cultivators.spirit_stones,
          });

        if (!updatedCultivator) {
          // 查询余额以确定是钱不够还是人不对（通常是钱不够）
          const exist = await tx
            .select({ money: cultivators.spirit_stones })
            .from(cultivators)
            .where(eq(cultivators.id, cultivatorId))
            .limit(1);
          if (exist.length > 0) {
            throw new Error(
              `囊中羞涩，灵石不足 (需 ${totalPrice}，余 ${exist[0].money})`,
            );
          } else {
            throw new Error('道友查无此人，请重新登录');
          }
        }

        // 简单验证拥有权（虽然上面 update 已经隐含验证了 id 存在，但如果有更复杂的权限逻辑可以在这加，或者在前面 query）
        // 这里假设只要扣钱成功就是合法的，因为 authenticated user 才能传进来 (待完善: 确保 cultivatorId 属于 user)
        // 为了严格安全，应该先查 owner。但为了性能，我们在 update 后不再查。
        // *更好的做法*: 在 update 前先查 owner，或者把 owner 校验加到 update where 里。
        // 让我们稍微优化一下，把 owner check 放在最前面（无 lock 时），或者信任 request 中的 cultivatorId 属于当前 user（假设前端传对，后端没做严格归属校验是一个风险点）。
        // *修正*: 第一版代码里有 `cultivator.userId !== user.id` 的检查。我们应该保留这个检查。

        // 重新插入 owner check 逻辑 (不影响性能太多的情况下)
        const ownerCheck = await tx.query.cultivators.findFirst({
          where: eq(cultivators.id, cultivatorId),
          columns: { userId: true },
        });

        if (!ownerCheck || ownerCheck.userId !== user.id) {
          throw new Error('非本人道号，不可操作');
        }

        // 5.2 Add Material
        await tx.insert(materials).values({
          cultivatorId,
          name: item.name,
          type: item.type,
          rank: item.rank,
          element: item.element,
          description: item.description,
          details: item.details || {},
          quantity: quantity,
        });
      });

      // 6. Update Redis Stock
      item.quantity -= quantity;
      if (item.quantity <= 0) {
        listings.splice(itemIndex, 1);
      } else {
        listings[itemIndex] = item;
      }

      if (await redis.exists(MARKET_CACHE_KEY)) {
        await redis.set(MARKET_CACHE_KEY, listings, { keepTtl: true });
      }

      return NextResponse.json({
        success: true,
        remainingFunds: 'check_frontend',
        message: `成功购入 ${item.name} x${quantity}`,
        item,
      });
    } finally {
      // 7. Release Lock
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error('Market Buy Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '交易失败，天道紊乱' },
      { status: 500 },
    );
  }
}
