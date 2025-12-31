import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
});

export const POST = withActiveCultivator(
  async (req: NextRequest, { cultivator }) => {
    const body = await req.json();
    const { mapNodeId } = StartSchema.parse(body);
    const result = await dungeonService.startDungeon(cultivator.id, mapNodeId);
    return NextResponse.json(result);
  },
);
