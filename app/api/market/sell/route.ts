import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  MarketRecycleError,
  confirmSell,
  previewSell,
} from '@/lib/services/MarketRecycleService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const PreviewSchema = z.object({
  phase: z.literal('preview'),
  materialIds: z.array(z.string()).min(1),
});

const ConfirmSchema = z.object({
  phase: z.literal('confirm'),
  sessionId: z.string().min(1),
});

const SellSchema = z.discriminatedUnion('phase', [PreviewSchema, ConfirmSchema]);

export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const body = await request.json();
      const parsed = SellSchema.parse(body);

      if (parsed.phase === 'preview') {
        const result = await previewSell(
          {
            id: cultivator.id,
          },
          parsed.materialIds,
        );
        return NextResponse.json(result);
      }

      const result = await confirmSell(cultivator.id, parsed.sessionId);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: error.issues[0]?.message || '参数格式错误' },
          { status: 400 },
        );
      }
      if (error instanceof MarketRecycleError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error('market sell api error:', error);
      return NextResponse.json({ error: '回收失败，请稍后再试' }, { status: 500 });
    }
  },
);
