import { withActiveCultivator } from '@/lib/api/withAuth';
import { AuctionServiceError, buyItem } from '@/lib/services/AuctionService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const BuySchema = z.object({
  listingId: z.string().uuid(),
});

/**
 * POST /api/auction/buy
 * 购买拍卖行物品
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const body = await request.json();
      const { listingId } = BuySchema.parse(body);

      await buyItem({
        listingId,
        buyerCultivatorId: cultivator.id,
        buyerCultivatorName: cultivator.name,
      });

      return NextResponse.json({
        success: true,
        message: '成功购入物品，请查收邮件',
      });
    } catch (error) {
      // 处理 Zod 验证错误
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: '参数错误', details: error.issues },
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
      console.error('Auction Buy API Error:', error);
      return NextResponse.json(
        { error: '购买失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
