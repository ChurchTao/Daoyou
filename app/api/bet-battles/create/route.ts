import { withActiveCultivator } from '@/lib/api/withAuth';
import { createMessage } from '@/lib/repositories/worldChatRepository';
import {
  BetBattleServiceError,
  createBetBattle,
} from '@/lib/services/BetBattleService';
import { REALM_VALUES } from '@/types/constants';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateBetBattleSchema = z.object({
  minRealm: z.enum(REALM_VALUES),
  maxRealm: z.enum(REALM_VALUES),
  taunt: z
    .string()
    .trim()
    .refine((value) => Array.from(value).length <= 20, {
      message: '狠话最多20字',
    })
    .optional(),
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
  async (request: NextRequest, { user, cultivator }) => {
    try {
      const body = await request.json();
      const { minRealm, maxRealm, taunt, stakeType, spiritStones, stakeItem } =
        CreateBetBattleSchema.parse(body);

      const result = await createBetBattle({
        creatorId: cultivator.id,
        creatorName: cultivator.name,
        minRealm,
        maxRealm,
        taunt,
        stakeType,
        spiritStones,
        stakeItem,
      });

      const rumor = taunt?.trim()
        ? `${cultivator.name}在赌战台放话：${taunt.trim()} 有胆便来应战！`
        : `${cultivator.name}在赌战台摆下战帖，静候各路道友应战！`;
      try {
        await createMessage({
          senderUserId: user.id,
          senderCultivatorId: null,
          senderName: '修仙界传闻',
          senderRealm: '炼气',
          senderRealmStage: '系统',
          messageType: 'duel_invite',
          textContent: rumor,
          payload: {
            battleId: result.battleId,
            routePath: '/game/bet-battle',
            taunt: taunt?.trim() || undefined,
            expiresAt: undefined,
          },
        });
      } catch (chatError) {
        console.error(
          'Bet battle created but world chat broadcast failed:',
          chatError,
        );
      }

      return NextResponse.json({
        success: true,
        battleId: result.battleId,
        message: '赌战发起成功，等待道友应战',
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

      console.error('Create bet battle API error:', error);
      return NextResponse.json(
        { error: '发起赌战失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
