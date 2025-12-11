import { redis } from '@/lib/redis';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
} from '@/types/constants';
import { object } from '@/utils/aiClient';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MARKET_CACHE_KEY = 'market:listings';
const MARKET_LOCK_KEY = 'market:generating';
const MARKET_CACHE_TTL = 3600; // 1 hour

// Schema for AI generation
const MaterialSchema = z.object({
  name: z.string(),
  type: z.enum(MATERIAL_TYPE_VALUES),
  rank: z.enum(QUALITY_VALUES),
  element: z.enum(ELEMENT_VALUES),
  description: z.string(),
  price: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10),
  details: z.record(z.string(), z.any()).optional(),
});

const MarketBatchSchema = z.object({
  items: z.array(MaterialSchema).length(10),
});

export async function GET() {
  try {
    // 1. Check Redis cache
    const cachedListings = await redis.get(MARKET_CACHE_KEY);
    const ttl = await redis.ttl(MARKET_CACHE_KEY);

    if (cachedListings && ttl > 0) {
      return NextResponse.json({
        listings: cachedListings,
        nextRefresh: Date.now() + ttl * 1000,
      });
    }

    // 2. Generate new listings if cache empty or expired

    // Try to acquire lock to prevent duplicate generation
    const acquiredLock = await redis.set(MARKET_LOCK_KEY, 'true', {
      nx: true,
      ex: 60,
    });

    if (!acquiredLock) {
      // If locked, return 503
      return NextResponse.json(
        { error: '坊市正在进货中，请稍后再试' },
        { status: 503 },
      );
    }

    try {
      const prompt = `
      你是一个修仙世界的「天道」系统。请生成一批（10个）随机的修仙材料，用于「坊市」出售。
      
      要求：
      1. 材料种类包含：药材(herb)、矿石(ore)、妖兽材料(monster)、天材地宝(tcdb)、特殊辅料(aux)。
      2. 随机分配品阶(rank)：${QUALITY_VALUES.join(', ')}。越稀有概率越低。
         - 凡品/灵品: 40%
         - 玄品/真品: 30%
         - 地品: 20%
         - 天品: 10%
         - 仙品: 5%
         - 神品: 2%
         - 其中天材地宝(tcdb)、特殊辅料(aux)的稀有度起步为玄品。
      3. 随机分配五行元素(element)。
      4. 自动定价(price)：灵石。
         - 凡品: 10-100
         - 灵品: 100-500
         - 玄品: 500-1000
         - 真品: 1000-5000
         - 地品: 5000-10000
         - 天品: 10000-50000
         - 仙品: 50000-100000
         - 神品: 100000+
      5. description 详细描述材料的用途、效果、来源等，符合修仙世界观，最多100字。
    `;

      const aiResponse = await object('你是一个修仙游戏生成器', prompt, {
        schema: MarketBatchSchema,
        schemaName: '修仙界的材料，用于坊市出售、炼器、炼药',
      });

      // Add IDs to items
      const itemsWithIds = aiResponse.object.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));

      // 3. Save to Redis
      await redis.set(MARKET_CACHE_KEY, itemsWithIds, {
        ex: MARKET_CACHE_TTL,
      });

      return NextResponse.json({
        listings: itemsWithIds,
        nextRefresh: Date.now() + MARKET_CACHE_TTL * 1000,
      });
    } finally {
      // Release lock
      await redis.del(MARKET_LOCK_KEY);
    }
  } catch (error) {
    console.error('Market API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market listings' },
      { status: 500 },
    );
  }
}

export async function POST() {
  // Manually trigger refresh (for debug or admin)
  await redis.del(MARKET_CACHE_KEY);
  return GET();
}
