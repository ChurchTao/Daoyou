import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  FateReshapeService,
  FateReshapeServiceError,
} from '@/lib/services/FateReshapeService';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    try {
      const session = await FateReshapeService.rerollSession(cultivator.id);

      return NextResponse.json({
        success: true,
        data: { session },
      });
    } catch (error) {
      const status =
        error instanceof FateReshapeServiceError ? error.status : 400;
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '命格重抽失败',
        },
        { status },
      );
    }
  },
);
