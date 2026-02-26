import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  BetBattleServiceError,
  cancelBetBattle,
} from '@/lib/services/BetBattleService';
import { NextRequest, NextResponse } from 'next/server';

const statusMap: Record<string, number> = {
  INVALID_STAKE: 400,
  INVALID_REALM_RANGE: 400,
  MAX_ACTIVE_BATTLE: 400,
  BATTLE_NOT_FOUND: 404,
  BATTLE_EXPIRED: 400,
  BATTLE_NOT_PENDING: 400,
  NOT_CREATOR: 403,
  CHALLENGE_SELF: 400,
  CHALLENGER_REALM_MISMATCH: 400,
  CHALLENGER_STAKE_MISMATCH: 400,
  ITEM_NOT_FOUND: 404,
  INVALID_QUANTITY: 400,
  INSUFFICIENT_SPIRIT_STONES: 400,
  CONCURRENT_OPERATION: 429,
};

export const POST = withActiveCultivator(
  async (_request: NextRequest, { cultivator }, params) => {
    try {
      await cancelBetBattle(params.id, cultivator.id);
      return NextResponse.json({
        success: true,
        message: '赌战已取消，押注将通过邮件返还',
      });
    } catch (error) {
      if (error instanceof BetBattleServiceError) {
        const status = statusMap[error.code] || 400;
        return NextResponse.json({ error: error.message }, { status });
      }

      console.error('Cancel bet battle API error:', error);
      return NextResponse.json(
        { error: '取消赌战失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
