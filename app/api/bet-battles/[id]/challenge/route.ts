import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

export const POST = withActiveCultivator(
  async () => {
    return NextResponse.json(
      {
        error:
          '旧接口 /api/bet-battles/[id]/challenge 已废弃，请使用 /api/bet-battles/[id]/challenge/v5',
      },
      { status: 410 },
    );
  },
);
