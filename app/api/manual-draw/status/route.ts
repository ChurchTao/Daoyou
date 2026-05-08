import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  ManualDrawService,
  ManualDrawServiceError,
} from '@/lib/services/ManualDrawService';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    try {
      const status = await ManualDrawService.getStatus(cultivator.id);

      return NextResponse.json({
        success: true,
        data: status,
      });
    } catch (error) {
      const status =
        error instanceof ManualDrawServiceError ? error.status : 400;
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '获取抽取状态失败',
        },
        { status },
      );
    }
  },
);
