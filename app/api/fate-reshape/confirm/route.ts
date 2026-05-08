import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  FateReshapeService,
  FateReshapeServiceError,
} from '@/lib/services/FateReshapeService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ConfirmSchema = z.object({
  selectedIndices: z.array(z.number().int().nonnegative()).length(3),
});

export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    try {
      const body = await request.json();
      const parsed = ConfirmSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: '请求参数格式错误' },
          { status: 400 },
        );
      }

      const selectedFates = await FateReshapeService.confirmSession(
        user.id,
        cultivator.id,
        parsed.data.selectedIndices,
      );

      return NextResponse.json({
        success: true,
        data: { selectedFates },
      });
    } catch (error) {
      const status =
        error instanceof FateReshapeServiceError ? error.status : 400;
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '确认命格重塑失败',
        },
        { status },
      );
    }
  },
);
