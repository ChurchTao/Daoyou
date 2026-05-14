import * as betBattleRepository from '@server/lib/repositories/betBattleRepository';
import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import {
  BetBattleServiceError,
  cancelBetBattle,
  challengeBetBattle,
  createBetBattle,
} from '@server/lib/services/BetBattleService';
import { REALM_VALUES } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const ListingsSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

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
  CONSUMABLE_STAKE_DISABLED: 400,
};

const router = new Hono<AppEnv>();

router.get('/listings', async (c) => {
  try {
    const params = ListingsSchema.parse({
      page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    });

    const result = await betBattleRepository.findPendingBetBattles(params);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(result.total / limit);

    return c.json({
      listings: result.listings,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    console.error('Bet battle listings API error:', error);
    return c.json({ error: '获取赌战列表失败' }, 500);
  }
});

router.get('/my', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const params = ListingsSchema.parse({
      page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    });

    const result = await betBattleRepository.findMyBetBattles(cultivator.id, params);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(result.total / limit);

    return c.json({
      listings: result.listings,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    console.error('My bet battles API error:', error);
    return c.json({ error: '获取我的赌战失败' }, 500);
  }
});

router.post('/create', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { minRealm, maxRealm, taunt, stakeType, spiritStones, stakeItem } =
      CreateBetBattleSchema.parse(await c.req.json());

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

    return c.json({
      success: true,
      battleId: result.battleId,
      message: '赌战发起成功，等待道友应战',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (error instanceof BetBattleServiceError) {
      return jsonWithStatus(c, { error: error.message }, statusMap[error.code] || 400);
    }

    console.error('Create bet battle API error:', error);
    return c.json({ error: '发起赌战失败，请稍后重试' }, 500);
  }
});

router.post('/:id/cancel', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    await cancelBetBattle(c.req.param('id'), cultivator.id);
    return c.json({
      success: true,
      message: '赌战已取消，押注将通过邮件返还',
    });
  } catch (error) {
    if (error instanceof BetBattleServiceError) {
      return jsonWithStatus(c, { error: error.message }, statusMap[error.code] || 400);
    }

    console.error('Cancel bet battle API error:', error);
    return c.json({ error: '取消赌战失败，请稍后重试' }, 500);
  }
});

router.post('/:id/challenge', requireActiveCultivator(), (c) => {
  return c.json(
    {
      error:
        '旧接口 /api/bet-battles/[id]/challenge 已废弃，请使用 /api/bet-battles/[id]/challenge/v5',
    },
    410,
  );
});

router.post('/:id/challenge/v5', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { stakeType, spiritStones, stakeItem } = ChallengeBetBattleSchema.parse(
      await c.req.json(),
    );

    const result = await challengeBetBattle({
      battleId: c.req.param('id'),
      challengerId: cultivator.id,
      challengerName: cultivator.name,
      challengerUserId: user.id,
      stakeType,
      spiritStones,
      stakeItem,
    });

    const isWin = result.winnerId === cultivator.id;
    const resultMessage = isWin
      ? '你力压对手，赢得赌战押注，奖励已发放邮件。'
      : '你此战失利，押注归对方所有，下次再战。';

    return c.json({
      type: 'battle_result',
      battleResult: result.battleResult,
      settlement: {
        isWin,
        winnerId: result.winnerId,
        battleId: result.battleId,
        battleRecordV2Id: result.battleRecordV2Id,
        resultMessage,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (error instanceof BetBattleServiceError) {
      return jsonWithStatus(c, { error: error.message }, statusMap[error.code] || 400);
    }

    console.error('Challenge bet battle v5 API error:', error);
    return c.json({ error: '应战失败，请稍后重试' }, 500);
  }
});

export default router;
