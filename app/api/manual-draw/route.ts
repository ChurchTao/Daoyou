import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  ManualDrawService,
  ManualDrawServiceError,
} from '@/lib/services/ManualDrawService';
import { MANUAL_DRAW_KIND_VALUES } from '@/types/manualDraw';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const DrawSchema = z.object({
  kind: z.enum(MANUAL_DRAW_KIND_VALUES),
  count: z.union([z.literal(1), z.literal(5)]),
});

export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    try {
      const body = await request.json();
      const parsed = DrawSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: '请求参数格式错误' },
          { status: 400 },
        );
      }

      const result = await ManualDrawService.draw(
        user.id,
        cultivator.id,
        parsed.data.kind,
        parsed.data.count,
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const status =
        error instanceof ManualDrawServiceError ? error.status : 400;
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '秘籍抽取失败',
        },
        { status },
      );
    }
  },
);
