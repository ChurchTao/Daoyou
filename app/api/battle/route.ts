import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

/**
 * @deprecated 旧 SSE 接口，已废弃。
 * POST /api/battle
 */
export const POST = withActiveCultivator(
  async () => {
    return NextResponse.json(
      { error: '旧接口 /api/battle 已废弃，请使用 /api/battle/v5' },
      { status: 410 },
    );
  },
);
