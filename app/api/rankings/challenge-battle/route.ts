import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

/**
 * POST /api/rankings/challenge-battle
 * 挑战战斗接口：执行挑战战斗并生成战斗播报（SSE 流式输出）
 * 在战斗结束后自动更新排名
 */
export const POST = withActiveCultivator(
  async () => {
    return NextResponse.json(
      {
        error:
          '旧接口 /api/rankings/challenge-battle 已废弃，请使用 /api/rankings/challenge-battle/v5',
      },
      { status: 410 },
    );
  },
);
