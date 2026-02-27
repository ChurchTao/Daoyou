import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { GeneratedMaterial } from '@/engine/material/creation/types';
import { redis } from '@/lib/redis';
import { shuffle } from '@/lib/utils';
import { after, NextResponse } from 'next/server';

const MARKET_CACHE_KEY = 'market:listings';
const MARKET_LOCK_KEY = 'market:generating';
const MARKET_CACHE_TTL = 7200; // 2 hours
const MARKET_STALE_RETRY_MS = 15000;

type MarketListing = GeneratedMaterial & { id: string };
type MarketCacheData = {
  listings: MarketListing[];
  nextRefresh: number;
};

async function refreshMarketInBackground() {
  const startedAt = Date.now();
  console.info('[MarketRefresh] background refresh started');
  try {
    const items = await MaterialGenerator.generateRandom(15);
    console.info(
      `[MarketRefresh] materials generated count=${items.length} costMs=${Date.now() - startedAt}`,
    );
    const itemsWithIds = items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));

    const nextRefresh = Date.now() + MARKET_CACHE_TTL * 1000;
    const newData: MarketCacheData = {
      listings: shuffle(itemsWithIds),
      nextRefresh,
    };

    await redis.set(MARKET_CACHE_KEY, newData);
    console.info(
      `[MarketRefresh] cache updated listings=${newData.listings.length} nextRefresh=${new Date(nextRefresh).toISOString()}`,
    );
  } catch (error) {
    console.error('Market background refresh failed:', error);
  } finally {
    await redis.del(MARKET_LOCK_KEY);
    console.info(
      `[MarketRefresh] lock released totalCostMs=${Date.now() - startedAt}`,
    );
  }
}

async function getMarketListings(): Promise<MarketCacheData> {
  const raw = (await redis.get(MARKET_CACHE_KEY)) as
    | MarketCacheData
    | MarketListing[]
    | null;

  // Handle legacy cache format (array) or null
  const cachedData: MarketCacheData | null = Array.isArray(raw) ? null : raw;
  const now = Date.now();

  // Fresh cache: return immediately
  if (cachedData && cachedData.nextRefresh > now) {
    return cachedData;
  }

  console.info(
    `[MarketRefresh] cache stale_or_missing hasCache=${Boolean(cachedData)} now=${new Date(now).toISOString()} nextRefresh=${cachedData?.nextRefresh ?? 0}`,
  );

  // Cache missing or expired: only one request can schedule background refresh.
  const acquiredLock = await redis.set(MARKET_LOCK_KEY, 'true', {
    nx: true,
    ex: 60,
  });

  if (acquiredLock) {
    console.info('[MarketRefresh] lock acquired, scheduling after() refresh');
    after(async () => {
      await refreshMarketInBackground();
    });
  } else {
    console.info('[MarketRefresh] lock busy, skip scheduling new refresh');
  }

  // During refresh, return stale cache if any; otherwise return empty.
  if (cachedData) {
    return {
      listings: cachedData.listings,
      nextRefresh: now + MARKET_STALE_RETRY_MS,
    };
  }

  return {
    listings: [],
    nextRefresh: now + MARKET_STALE_RETRY_MS,
  };
}

export async function GET() {
  try {
    const data = await getMarketListings();
    return NextResponse.json(data);
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
