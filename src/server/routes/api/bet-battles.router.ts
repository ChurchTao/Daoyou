import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import * as betBattleRepository from '@server/lib/repositories/betBattleRepository';
import {
  BetBattleServiceError,
  MAX_BET_BATTLE_SPIRIT_STONES,
} from '@server/lib/services/BetBattleService';
import {
  cancelBetBattleCommand,
  challengeBetBattleCommand,
  createBetBattleCommand,
} from '@server/lib/services/BetBattleApplicationService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { stableCompactStringify } from '@server/utils/llmPayload';
import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
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
  spiritStones: z
    .number()
    .int()
    .min(0)
    .max(MAX_BET_BATTLE_SPIRIT_STONES)
    .optional(),
  stakeItem: z
    .object({
      itemType: z.enum(['material', 'artifact', 'consumable']),
      itemId: z.string().uuid(),
      quantity: z.number().int().min(1).max(MAX_PLAYER_ITEM_QUANTITY),
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
      quantity: z.number().int().min(1).max(MAX_PLAYER_ITEM_QUANTITY),
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

router.get('/my', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const params = ListingsSchema.parse({
      page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    });

    const result = await betBattleRepository.findMyBetBattles(
      cultivator.cultivatorId,
      params,
    );
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

router.post('/create', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { minRealm, maxRealm, taunt, stakeType, spiritStones, stakeItem } =
      CreateBetBattleSchema.parse(await c.req.json());

    const committed = await createBetBattleCommand({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      minRealm,
      maxRealm,
      taunt,
      stakeType,
      spiritStones,
      stakeItem,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (error instanceof BetBattleServiceError) {
      return jsonWithStatus(
        c,
        { error: error.message },
        statusMap[error.code] || 400,
      );
    }

    console.error('Create bet battle API error:', error);
    return c.json({ error: '发起赌战失败，请稍后重试' }, 500);
  }
});

router.post('/:id/cancel', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const battleId = c.req.param('id');
    const committed = await cancelBetBattleCommand({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      battleId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof BetBattleServiceError) {
      return jsonWithStatus(
        c,
        { error: error.message },
        statusMap[error.code] || 400,
      );
    }

    console.error('Cancel bet battle API error:', error);
    return c.json({ error: '取消赌战失败，请稍后重试' }, 500);
  }
});

router.post('/:id/challenge', requireActiveCultivatorRef(), (c) => {
  return c.json(
    {
      error:
        '旧接口 /api/bet-battles/[id]/challenge 已废弃，请使用 /api/bet-battles/[id]/challenge/v5',
    },
    410,
  );
});

router.post('/:id/challenge/v5', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { stakeType, spiritStones, stakeItem } =
      ChallengeBetBattleSchema.parse(await c.req.json());

    const battleId = c.req.param('id');
    const requestFingerprint = stableCompactStringify({
      battleId,
      cultivatorId: cultivator.cultivatorId,
      stakeType,
      spiritStones: spiritStones ?? 0,
      stakeItem: stakeItem ?? null,
    });
    const committed = await challengeBetBattleCommand({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      battleId,
      requestFingerprint,
      stakeType,
      spiritStones,
      stakeItem,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (error instanceof BetBattleServiceError) {
      return jsonWithStatus(
        c,
        { error: error.message },
        statusMap[error.code] || 400,
      );
    }

    console.error('Challenge bet battle v5 API error:', error);
    return c.json({ error: '应战失败，请稍后重试' }, 500);
  }
});

export default router;
