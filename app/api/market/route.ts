import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  clearMarketCache,
  getCompatibilityDefaults,
  getMarketListings,
  MarketServiceError,
} from '@/lib/services/MarketService';
import { RealmType } from '@/types/constants';
import { NextResponse } from 'next/server';

/**
 * Deprecated compatibility route.
 * Prefer: GET /api/market/[nodeId]?layer=common|treasure|heaven|black
 */
export const GET = withActiveCultivator(async (_request, { cultivator }) => {
  try {
    const { nodeId, layer } = getCompatibilityDefaults();
    const data = await getMarketListings({
      nodeId,
      layer,
      cultivatorRealm: cultivator.realm as RealmType,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof MarketServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Market compatibility GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market listings' },
      { status: 500 },
    );
  }
});

/**
 * Deprecated compatibility route.
 * Prefer: POST /api/market/[nodeId]
 */
export const POST = withActiveCultivator(async (_request, { cultivator }) => {
  try {
    const { nodeId, layer } = getCompatibilityDefaults();
    await clearMarketCache(nodeId, layer);
    const data = await getMarketListings({
      nodeId,
      layer,
      cultivatorRealm: cultivator.realm as RealmType,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof MarketServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Market compatibility POST error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh market listings' },
      { status: 500 },
    );
  }
});
