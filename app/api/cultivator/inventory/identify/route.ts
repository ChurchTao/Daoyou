import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  identifyMysteryMaterial,
  MarketServiceError,
} from '@/lib/services/MarketService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const IdentifySchema = z.object({
  materialId: z.string().min(1),
});

export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const body = await request.json();
      const { materialId } = IdentifySchema.parse(body);
      const result = await identifyMysteryMaterial({
        materialId,
        cultivatorId: cultivator.id,
      });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof MarketServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: error.issues[0]?.message || '参数错误' },
          { status: 400 },
        );
      }
      console.error('Identify API error:', error);
      return NextResponse.json({ error: '鉴定失败' }, { status: 500 });
    }
  },
);
