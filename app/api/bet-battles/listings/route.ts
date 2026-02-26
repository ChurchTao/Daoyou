import * as betBattleRepository from '@/lib/repositories/betBattleRepository';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ListingsSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = ListingsSchema.parse({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit')
        ? Number(searchParams.get('limit'))
        : undefined,
    });

    const result = await betBattleRepository.findPendingBetBattles(params);
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数错误', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Bet battle listings API error:', error);
    return NextResponse.json({ error: '获取赌战列表失败' }, { status: 500 });
  }
}
