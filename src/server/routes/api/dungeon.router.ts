import { getExecutor } from '@server/lib/drizzle/db';
import { dungeonHistories } from '@server/lib/drizzle/schema';
import {
  checkDungeonLimit,
  getDungeonLimitConfig,
} from '@server/lib/dungeon/dungeonLimiter';
import {
  DungeonFlowError,
  dungeonService,
} from '@server/lib/dungeon/service_v2';
import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  DungeonStartError,
  executeDungeonCommand,
} from '@server/lib/services/DungeonApplicationService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { DungeonBattlePlanSchema } from '@shared/lib/dungeon/battlePlan';
import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
  entrySource: z.literal('sect_task').optional(),
});

const ActionSchema = z.object({
  choiceId: z.number(),
  actionId: z.string().min(1).optional(),
});

const LootingContinueSchema = z.object({
  requestId: z.string().min(1).max(120).optional(),
});

const RecoverSchema = z.object({
  action: z.enum([
    'retry',
    'retry_continue',
    'retry_settle',
    'safe_retreat',
    'force_quit',
  ]),
});

const router = new Hono<AppEnv>();
const historyRouter = new Hono<AppEnv>();
const limitRouter = new Hono<AppEnv>();
const lootingRouter = new Hono<AppEnv>();
const battleRouter = new Hono<AppEnv>();

const BattleIdQuerySchema = z.object({
  battleId: z.string().min(1),
});

const BattleIdBodySchema = z.object({
  battleId: z.string().min(1),
  requestId: z.string().min(1).max(120).optional(),
});

const BattleExecuteBodySchema = BattleIdBodySchema.extend({
  battlePlan: DungeonBattlePlanSchema.default('standard'),
});

router.post('/start', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { mapNodeId, entrySource } = StartSchema.parse(await c.req.json());

  try {
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'start', mapNodeId, entrySource },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonStartError) {
      return jsonWithStatus(
        c,
        {
          error: error.message,
          ...(error.readiness ? { readiness: error.readiness } : {}),
        },
        error.status,
      );
    }
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    if (error instanceof QiInsufficientError) {
      return c.json(
        {
          error: error.code,
          message: error.message,
          required: error.required,
          current: error.current,
          action: error.action,
        },
        409,
      );
    }
    if (error instanceof QiServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    throw error;
  }
});

router.get('/state', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const state = await dungeonService.getState(cultivator.cultivatorId);
  return c.json({ state });
});

router.post('/action', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { choiceId, actionId } = ActionSchema.parse(await c.req.json());
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'action', choiceId, actionId },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : '副本推进失败';
    const status = /不足|没有符合条件|资源消耗失败/.test(message) ? 409 : 500;
    return c.json({ error: message }, status);
  }
});

router.post('/recover', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { action } = RecoverSchema.parse(await c.req.json());
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'recover', action },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : '副本恢复失败';
    return c.json({ error: message }, 500);
  }
});

router.post('/quit', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'quit' },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    throw error;
  }
});

historyRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(c.req.query('pageSize') || '10', 10)),
  );
  const offset = (page - 1) * pageSize;

  const countResult = await getExecutor()
    .select({ count: sql<number>`count(*)` })
    .from(dungeonHistories)
    .where(eq(dungeonHistories.cultivatorId, cultivator.cultivatorId));

  const total = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(total / pageSize);
  const records = await getExecutor()
    .select({
      id: dungeonHistories.id,
      theme: dungeonHistories.theme,
      result: dungeonHistories.result,
      log: dungeonHistories.log,
      realGains: dungeonHistories.realGains,
      createdAt: dungeonHistories.createdAt,
    })
    .from(dungeonHistories)
    .where(eq(dungeonHistories.cultivatorId, cultivator.cultivatorId))
    .orderBy(desc(dungeonHistories.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    success: true,
    data: {
      records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    },
  });
});

limitRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const limit = await checkDungeonLimit(cultivator.cultivatorId);
  const config = getDungeonLimitConfig();
  return c.json({
    success: true,
    data: {
      ...limit,
      dailyLimit: config.dailyLimit,
    },
  });
});

lootingRouter.post('/continue', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { requestId } = LootingContinueSchema.parse(
      await c.req.json().catch(() => ({})),
    );

    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'looting-continue', requestId },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : '副本推进失败';
    return c.json({ error: message }, 500);
  }
});

lootingRouter.post('/escape', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'looting-escape' },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : '副本结算失败';
    return c.json({ error: message }, 500);
  }
});

battleRouter.get('/probe', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId } = BattleIdQuerySchema.parse({
      battleId: c.req.query('battleId'),
    });
    const enemy = await dungeonService.probeBattleEnemy(
      cultivator.cultivatorId,
      battleId,
    );
    return c.json({
      success: true,
      enemy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '遭遇战查探失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

battleRouter.post('/abandon', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId } = BattleIdBodySchema.parse(await c.req.json());
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'battle-abandon', battleId },
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : '放弃遭遇战失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

battleRouter.post('/execute/v5', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId, battlePlan, requestId } = BattleExecuteBodySchema.parse(
      await c.req.json(),
    );
    const responsePayload = await executeDungeonCommand({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
      command: {
        kind: 'battle-execute',
        battleId,
        battlePlan,
        requestId,
      },
    });
    return c.json(responsePayload);
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message = error instanceof Error ? error.message : '遭遇战执行失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

router.route('/history', historyRouter);
router.route('/limit', limitRouter);
router.route('/looting', lootingRouter);
router.route('/battle', battleRouter);

export default router;
