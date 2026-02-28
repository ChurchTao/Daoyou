import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  clearMarketCache,
  getMarketListings,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@/lib/services/MarketService';
import { RealmType } from '@/types/constants';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }, params) => {
    try {
      const { nodeId: rawNodeId } = await params;
      const nodeId = resolveNodeId(rawNodeId);
      const layer = resolveLayer(request.nextUrl.searchParams.get('layer'));

      const result = await getMarketListings({
        nodeId,
        layer,
        cultivatorRealm: cultivator.realm as RealmType,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof MarketServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      console.error('Market node API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch market listings' },
        { status: 500 },
      );
    }
  },
);

export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }, params) => {
    try {
      const { nodeId: rawNodeId } = await params;
      const nodeId = resolveNodeId(rawNodeId);
      const layer = resolveLayer(request.nextUrl.searchParams.get('layer'));
      await clearMarketCache(nodeId, layer);
      const result = await getMarketListings({
        nodeId,
        layer,
        cultivatorRealm: cultivator.realm as RealmType,
      });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof MarketServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      console.error('Market node refresh API error:', error);
      return NextResponse.json(
        { error: 'Failed to refresh market listings' },
        { status: 500 },
      );
    }
  },
);
