import { withActiveCultivator } from '@/lib/api/withAuth';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/craft/pending
 * 获取当前待确定的造物结果
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const url = new URL(request.url);
    const craftType = url.searchParams.get('type'); // 'create_skill' | 'create_gongfa'

    if (!craftType || !['create_skill', 'create_gongfa'].includes(craftType)) {
      return NextResponse.json({ error: '无效的造物类型' }, { status: 400 });
    }

    const pendingKey = `creation_pending:${cultivator.id}:${craftType}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingItem = await redis.get<any>(pendingKey);

    return NextResponse.json({
      success: true,
      hasPending: !!pendingItem,
      item: pendingItem || null,
    });
  },
);
