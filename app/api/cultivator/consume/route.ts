import { withActiveCultivator } from '@/lib/api/withAuth';
import { consumeItem } from '@/lib/services/cultivatorService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ConsumeSchema = z.object({
  consumableId: z.string(),
});

/**
 * POST /api/cultivator/consume
 * 使用消耗品
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const body = await request.json();
    const { consumableId } = ConsumeSchema.parse(body);

    try {
      const result = await consumeItem(user.id, cultivator.id, consumableId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : error },
        { status: 400 },
      );
    }
  },
);
