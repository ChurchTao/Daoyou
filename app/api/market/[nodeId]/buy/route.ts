import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  buyMarketItem,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@/lib/services/MarketService';
import { RealmType } from '@/types/constants';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const BuySchema = z.object({
  listingId: z.string().optional(),
  itemId: z.string().optional(),
  quantity: z.number().min(1).default(1),
  layer: z.enum(['common', 'treasure', 'heaven', 'black']).optional(),
});

export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }, params) => {
    try {
      const body = await request.json();
      const parsed = BuySchema.parse(body);
      const listingId = parsed.listingId || parsed.itemId;
      if (!listingId) {
        return NextResponse.json({ error: '缺少 listingId' }, { status: 400 });
      }

      const { nodeId: rawNodeId } = await params;
      const nodeId = resolveNodeId(rawNodeId);
      const layer =
        parsed.layer || resolveLayer(request.nextUrl.searchParams.get('layer'));

      const result = await buyMarketItem({
        nodeId,
        layer,
        listingId,
        quantity: parsed.quantity,
        cultivatorId: cultivator.id,
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
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: error.issues[0]?.message || '参数错误' },
          { status: 400 },
        );
      }
      console.error('Market buy API error:', error);
      return NextResponse.json({ error: '购买失败' }, { status: 500 });
    }
  },
);
