import { withActiveCultivator } from '@/lib/api/withAuth';
import { ConsumableUseEngine } from '@/lib/services/ConsumableUseEngine';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ConsumeSchema = z.object({
  consumableId: z.string().uuid(),
});

export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    try {
      const body = await request.json();
      const parsed = ConsumeSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: '请求参数格式错误' },
          { status: 400 },
        );
      }

      const result = await ConsumableUseEngine.consume(
        user.id,
        cultivator.id,
        parsed.data.consumableId,
      );

      return NextResponse.json({
        success: true,
        data: {
          message: result.message,
          consumable: result.consumable,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '使用失败',
        },
        { status: 400 },
      );
    }
  },
);

