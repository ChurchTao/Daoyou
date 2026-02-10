import { AuctionService, AuctionServiceError } from '@/lib/services/AuctionService';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ListSchema = z.object({
  itemType: z.enum(['material', 'artifact', 'consumable']),
  itemId: z.string().uuid(),
  price: z.number().int().min(1),
});

/**
 * POST /api/auction/list
 * 上架物品到拍卖行
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const body = await request.json();
      const { itemType, itemId, price } = ListSchema.parse(body);

      const result = await AuctionService.listItem({
        cultivatorId: cultivator.id,
        cultivatorName: cultivator.name,
        itemType,
        itemId,
        price,
      });

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      // 处理 Zod 验证错误
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: '参数错误', details: error.errors },
          { status: 400 },
        );
      }

      // 处理业务错误
      if (error instanceof AuctionServiceError) {
        const statusMap: Record<string, number> = {
          INSUFFICIENT_FUNDS: 400,
          LISTING_NOT_FOUND: 404,
          LISTING_EXPIRED: 400,
          NOT_OWNER: 403,
          MAX_LISTINGS: 400,
          ITEM_NOT_FOUND: 404,
          CONCURRENT_PURCHASE: 429,
          INVALID_ITEM_TYPE: 400,
          INVALID_PRICE: 400,
        };

        const status = statusMap[error.code] || 400;
        return NextResponse.json({ error: error.message }, { status });
      }

      // 处理其他错误
      console.error('Auction List API Error:', error);
      return NextResponse.json(
        { error: '上架失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
