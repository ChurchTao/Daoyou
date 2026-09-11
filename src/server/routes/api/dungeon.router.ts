import { getExecutor } from '@server/lib/drizzle/db';
import { dungeonHistories } from '@server/lib/drizzle/schema';
import {
  changeDungeonBattle,
  getDungeonBattle,
} from '@server/lib/dungeon/combatV6';
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
import { CombatAutoRequestSchema } from '@shared/combat-v6/auto';
import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@shared/contracts/combatV6';
import {
  DungeonActionRequestSchema,
  DungeonBeginBattleRequestSchema,
} from '@shared/contracts/combatV6Dungeon';
import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
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
battleRouter.post(
  '/sessions/:id/auto',
  requireActiveCultivatorRef(),
  async (c) => {
    const input = CombatAutoRequestSchema.parse(await c.req.json());
    const id = z.uuid().parse(c.req.param('id'));
    try {
      return c.json({
        success: true,
        data: await changeDungeonBattle(
          c.get('activeCultivatorRef')!,
          id,
          input.expectedRevision,
          undefined,
          input.round,
        ),
      });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : '自动指令提交失败' },
        409,
      );
    }
  },
);

battleRouter.get(
  '/sessions/current',
  requireActiveCultivatorRef(),
  async (c) => {
    return c.json({
      success: true,
      data: await getDungeonBattle(c.get('activeCultivatorRef')!.cultivatorId),
    });
  },
);
battleRouter.get('/sessions/:id', requireActiveCultivatorRef(), async (c) => {
  const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
  const data = await getDungeonBattle(
    c.get('activeCultivatorRef')!.cultivatorId,
    z.uuid().parse(c.req.param('id')),
    query.afterEventSeq,
  );
  return data
    ? c.json({ success: true, data })
    : c.json({ error: '战斗不存在' }, 404);
});
battleRouter.put(
  '/sessions/:id/commands/:unitId',
  requireActiveCultivatorRef(),
  async (c) => {
    const input = CombatV6TrainingCommandRequestSchema.parse(
      await c.req.json(),
    );
    try {
      const data = await changeDungeonBattle(
        {
          userId: c.get('user')!.id,
          cultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
        },
        z.uuid().parse(c.req.param('id')),
        input.expectedRevision,
        { unitId: c.req.param('unitId'), commands: input.commands },
      );
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : '提交失败' },
        409,
      );
    }
  },
);
battleRouter.post(
  '/sessions/:id/resolve',
  requireActiveCultivatorRef(),
  async (c) => {
    const input = CombatV6TrainingRevisionRequestSchema.parse(
      await c.req.json(),
    );
    try {
      const data = await changeDungeonBattle(
        {
          userId: c.get('user')!.id,
          cultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
        },
        z.uuid().parse(c.req.param('id')),
        input.expectedRevision,
      );
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : '结算失败' },
        409,
      );
    }
  },
);

const BattleIdBodySchema = z.object({
  battleId: z.string().min(1),
  requestId: z.string().min(1).max(120).optional(),
});

router.post('/start', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { mapNodeId } = StartSchema.parse(await c.req.json());

  try {
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'start', mapNodeId },
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

    const input = DungeonActionRequestSchema.parse(await c.req.json());
    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'action', ...input },
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
    if (error instanceof z.ZodError)
      return c.json({ error: '探索请求无效，请刷新后重试' }, 400);
    if (error instanceof DungeonStartError)
      return c.json({ error: message }, 409);
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

    return c.json(
      await executeDungeonCommand({
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        command: { kind: 'looting-continue' },
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

battleRouter.get('/probe', requireActiveCultivatorRef(), (c) =>
  c.json({ error: '旧查探入口已停用' }, 410),
);

battleRouter.post('/begin', requireActiveCultivatorRef(), async (c) => {
  const { encounterId } = DungeonBeginBattleRequestSchema.parse(
    await c.req.json(),
  );
  try {
    return c.json(
      await executeDungeonCommand({
        ...c.get('activeCultivatorRef')!,
        command: { kind: 'battle-begin', encounterId },
      }),
    );
  } catch (error) {
    const locked = redisLockErrorResponse(error);
    if (locked) return locked;
    if (error instanceof DungeonFlowError)
      return c.json({ error: error.message }, 409);
    throw error;
  }
});

battleRouter.post('/abandon', requireActiveCultivatorRef(), (c) =>
  c.json({ error: '旧放弃入口已停用，请使用战斗内逃跑' }, 410),
);

battleRouter.post('/complete', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId, requestId } = BattleIdBodySchema.parse(
      await c.req.json(),
    );
    const responsePayload = await executeDungeonCommand({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
      command: { kind: 'battle-execute', battleId, requestId },
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

battleRouter.post('/execute/v5', requireActiveCultivatorRef(), (c) =>
  c.json({ error: '旧战斗已停用，请刷新页面' }, 410),
);

router.route('/history', historyRouter);
router.route('/limit', limitRouter);
router.route('/looting', lootingRouter);
router.route('/battle', battleRouter);

export default router;
