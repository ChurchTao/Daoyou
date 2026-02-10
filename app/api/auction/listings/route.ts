import * as auctionRepository from '@/lib/repositories/auctionRepository';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ListingsSchema = z.object({
  itemType: z.enum(['material', 'artifact', 'consumable']).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'latest']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * GET /api/auction/listings
 * 获取拍卖列表（公开接口）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const params = ListingsSchema.parse({
      itemType: searchParams.get('itemType') || undefined,
      minPrice: searchParams.get('minPrice')
        ? Number(searchParams.get('minPrice'))
        : undefined,
      maxPrice: searchParams.get('maxPrice')
        ? Number(searchParams.get('maxPrice'))
        : undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      page: searchParams.get('page')
        ? Number(searchParams.get('page'))
        : undefined,
      limit: searchParams.get('limit')
        ? Number(searchParams.get('limit'))
        : undefined,
    });

    const result = await auctionRepository.findActiveListings(params);

    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      listings: result.listings,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    // 处理 Zod 验证错误
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数错误', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Auction Listings API Error:', error);
    return NextResponse.json(
      { error: '获取拍卖列表失败' },
      { status: 500 },
    );
  }
}
