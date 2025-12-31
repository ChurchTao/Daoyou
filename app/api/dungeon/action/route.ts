import { withActiveCultivator } from '@/lib/api/withAuth';
import { dungeonService } from '@/lib/dungeon/service_v2';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ActionSchema = z.object({
  choiceId: z.number(),
});

export const POST = withActiveCultivator(
  async (req: NextRequest, { cultivator }) => {
    const body = await req.json();
    const { choiceId } = ActionSchema.parse(body);
    const result = await dungeonService.handleAction(cultivator.id, choiceId);
    return NextResponse.json(result);
  },
);
