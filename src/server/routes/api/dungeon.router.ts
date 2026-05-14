import { getExecutor } from '@server/lib/drizzle/db';
import { dungeonHistories } from '@server/lib/drizzle/schema';
import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  checkDungeonLimit,
  getDungeonLimitConfig,
} from '@server/lib/dungeon/dungeonLimiter';
import { dungeonService } from '@server/lib/dungeon/service_v2';
import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
});

const ActionSchema = z.object({
  choiceId: z.number(),
});

const router = new Hono<AppEnv>();
const historyRouter = new Hono<AppEnv>();
const limitRouter = new Hono<AppEnv>();
const lootingRouter = new Hono<AppEnv>();

router.post('/start', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { mapNodeId } = StartSchema.parse(await c.req.json());
  const result = await dungeonService.startDungeon(cultivator.id, mapNodeId);
  return c.json(result);
});

router.get('/state', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const state = await dungeonService.getState(cultivator.id);
  return c.json({ state });
});

router.post('/action', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { choiceId } = ActionSchema.parse(await c.req.json());
  const result = await dungeonService.handleAction(cultivator.id, choiceId);
  return c.json(result);
});

router.post('/quit', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  await dungeonService.quitDungeon(cultivator.id);
  return c.json({ success: true });
});

historyRouter.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '10', 10)));
  const offset = (page - 1) * pageSize;

  const countResult = await getExecutor()
    .select({ count: sql<number>`count(*)` })
    .from(dungeonHistories)
    .where(eq(dungeonHistories.cultivatorId, cultivator.id));

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
    .where(eq(dungeonHistories.cultivatorId, cultivator.id))
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

limitRouter.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const limit = await checkDungeonLimit(cultivator.id);
  const config = getDungeonLimitConfig();
  return c.json({
    success: true,
    data: {
      ...limit,
      dailyLimit: config.dailyLimit,
    },
  });
});

lootingRouter.post('/continue', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const result = await dungeonService.continueFromLooting(cultivator.id);
  return c.json(result);
});

lootingRouter.post('/escape', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const result = await dungeonService.escapeFromLooting(cultivator.id);
  return c.json(result);
});

router.route('/history', historyRouter);
router.route('/limit', limitRouter);
router.route('/looting', lootingRouter);

export default router;
