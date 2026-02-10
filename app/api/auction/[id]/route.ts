import { AuctionService, AuctionServiceError } from '@/lib/services/AuctionService';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/auction/:id
 * 下架拍卖物品
 */
export const DELETE = withActiveCultivator(
  async (request: NextRequest, { cultivator }, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;

      await AuctionService.cancelListing(id, cultivator.id);

      return NextResponse.json({
        success: true,
        message: '物品已下架，将通过邮件返还',
      });
    } catch (error) {
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
      console.error('Auction Cancel API Error:', error);
      return NextResponse.json(
        { error: '下架失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
