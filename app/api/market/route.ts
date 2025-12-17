import { redis } from '@/lib/redis';
import { shuffle } from '@/lib/utils';
import {
  GeneratedMaterial,
  generateRandomMaterials,
} from '@/utils/materialGenerator';
import { NextResponse } from 'next/server';

const MARKET_CACHE_KEY = 'market:listings';
const MARKET_LOCK_KEY = 'market:generating';
const MARKET_CACHE_TTL = 7200; // 2 hours

export async function GET() {
  try {
    // 1. Check Redis cache
    let cachedData = (await redis.get(MARKET_CACHE_KEY)) as {
      listings: (GeneratedMaterial & { id: string })[];
      nextRefresh: number;
    } | null;

    // Handle legacy cache format (array) or null
    if (Array.isArray(cachedData)) {
      cachedData = null;
    }

    const now = Date.now();

    // 2. If valid cache exists, return it
    if (cachedData && cachedData.nextRefresh > now) {
      return NextResponse.json({
        listings: cachedData.listings,
        nextRefresh: cachedData.nextRefresh,
      });
    }

    // 3. If cache missing or expired, try to refresh
    // Try to acquire lock to prevent duplicate generation
    const acquiredLock = await redis.set(MARKET_LOCK_KEY, 'true', {
      nx: true,
      ex: 60,
    });

    if (!acquiredLock) {
      // If locked (someone else is generating) AND we have stale data, return stale data
      if (cachedData) {
        return NextResponse.json({
          listings: cachedData.listings,
          // Return stale data but tell client to check again in 5s
          nextRefresh: Date.now() + 5000,
        });
      }

      // If locked AND no data at all (rare cold start race), return 503
      return NextResponse.json(
        { error: '坊市正在进货中，请稍后再试' },
        { status: 503 },
      );
    }

    try {
      const items = await generateRandomMaterials(15);

      // Add IDs to items
      const itemsWithIds = items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));

      const nextRefresh = Date.now() + MARKET_CACHE_TTL * 1000;
      const newData = {
        listings: shuffle(itemsWithIds),
        nextRefresh,
      };

      // 4. Save to Redis (No TTL, or very long TTL to allow serving stale)
      await redis.set(MARKET_CACHE_KEY, newData);

      return NextResponse.json({
        listings: itemsWithIds,
        nextRefresh,
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
