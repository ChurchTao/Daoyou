import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { Material } from '@/types/cultivator';
import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MARKET_CACHE_KEY = 'market:listings';
const BUY_LOCK_PREFIX = 'market:buy:lock:';

const BuySchema = z.object({
  itemId: z.string(),
  quantity: z.number().min(1).default(1),
});

/**
 * POST /api/market/buy
 * 购买市场物品
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { itemId, quantity } = BuySchema.parse(body);
    const cultivatorId = cultivator.id;

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
      let cachedData = (await redis.get(MARKET_CACHE_KEY)) as {
        listings: Material[];
        nextRefresh: number;
      } | null;

      // Handle legacy cache or missing data
      if (Array.isArray(cachedData)) {
        // If legacy array, wrap it (though GET route fixes this, race conditions exist)
        cachedData = {
          listings: cachedData,
          nextRefresh: Date.now() + 7200000,
        };
      }

      if (!cachedData || !cachedData.listings) {
        return NextResponse.json(
          { error: '坊市正在进货中，暂未开启' },
          { status: 404 },
        );
      }

      const listings = cachedData.listings;

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
      await db().transaction(async (tx) => {
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
      cachedData.listings = listings;

      if (await redis.exists(MARKET_CACHE_KEY)) {
        await redis.set(MARKET_CACHE_KEY, cachedData, { keepTtl: true });
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
  },
);
