import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  FateReshapeService,
  FateReshapeServiceError,
} from '@/lib/services/FateReshapeService';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withActiveCultivator(
  async (_request: NextRequest, { cultivator }) => {
    try {
      const [session, talismanCount] = await Promise.all([
        FateReshapeService.getSession(cultivator.id),
        FateReshapeService.getAvailableTalismanCount(cultivator.id),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          session,
          talismanCount,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '获取命格重塑状态失败',
        },
        { status: 400 },
      );
    }
  },
);

export const POST = withActiveCultivator(
  async (_request: NextRequest, { user, cultivator }) => {
    try {
      const session = await FateReshapeService.startSession(
        user.id,
        cultivator.id,
      );
      const talismanCount = await FateReshapeService.getAvailableTalismanCount(
        cultivator.id,
      );

      return NextResponse.json({
        success: true,
        data: {
          session,
          talismanCount,
        },
      });
    } catch (error) {
      const status =
        error instanceof FateReshapeServiceError ? error.status : 400;
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '开启命格重塑失败',
        },
        { status },
      );
    }
  },
);
