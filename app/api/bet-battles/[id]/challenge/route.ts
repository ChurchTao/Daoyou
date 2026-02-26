import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  BetBattleServiceError,
  challengeBetBattle,
} from '@/lib/services/BetBattleService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ChallengeBetBattleSchema = z.object({
  stakeType: z.enum(['spirit_stones', 'item']),
  spiritStones: z.number().int().min(0).optional(),
  stakeItem: z
    .object({
      itemType: z.enum(['material', 'artifact', 'consumable']),
      itemId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
    .nullable()
    .optional(),
});

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
  async (request: NextRequest, { user, cultivator }, params) => {
    try {
      const body = await request.json();
      const { stakeType, spiritStones, stakeItem } =
        ChallengeBetBattleSchema.parse(body);

      const result = await challengeBetBattle({
        battleId: params.id,
        challengerId: cultivator.id,
        challengerName: cultivator.name,
        challengerUserId: user.id,
        stakeType,
        spiritStones,
        stakeItem,
      });

      return NextResponse.json({
        success: true,
        battleId: result.battleId,
        winnerId: result.winnerId,
        message: '战斗完成，奖励已通过邮件发放',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: '参数错误', details: error.issues },
          { status: 400 },
        );
      }

      if (error instanceof BetBattleServiceError) {
        const status = statusMap[error.code] || 400;
        return NextResponse.json({ error: error.message }, { status });
      }

      console.error('Challenge bet battle API error:', error);
      return NextResponse.json(
        { error: '应战失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
