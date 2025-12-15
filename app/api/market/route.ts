import { redis } from '@/lib/redis';
import { shuffle } from '@/lib/utils';
import { generateRandomMaterials } from '@/utils/materialGenerator';
import { NextResponse } from 'next/server';

const MARKET_CACHE_KEY = 'market:listings';
const MARKET_LOCK_KEY = 'market:generating';
const MARKET_CACHE_TTL = 7200; // 2 hours

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
      const items = await generateRandomMaterials(10);

      // Add IDs to items
      const itemsWithIds = items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));

      // 3. Save to Redis
      await redis.set(MARKET_CACHE_KEY, shuffle(itemsWithIds), {
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
