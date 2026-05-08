import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  FateReshapeService,
  FateReshapeServiceError,
} from '@/lib/services/FateReshapeService';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    try {
      await FateReshapeService.abandonSession(cultivator.id);

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      const status =
        error instanceof FateReshapeServiceError ? error.status : 400;
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '放弃命格重塑失败',
        },
        { status },
      );
    }
  },
);
