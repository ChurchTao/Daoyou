import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withActiveCultivator(
  async (req: NextRequest, { cultivator }) => {
    const result = await dungeonService.escapeFromLooting(cultivator.id);
    return NextResponse.json(result);
  },
);
