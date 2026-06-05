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
import { TaskService } from '@server/lib/services/TaskService';
import { getCultivatorByIdUnsafe } from '@server/lib/services/cultivatorService';
import { getCultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { getMapNode } from '@shared/lib/game/mapSystem';
import { evaluateNoviceReadiness } from '@shared/lib/noviceGuidance';
import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
});

const ActionSchema = z.object({
  choiceId: z.number(),
  actionId: z.string().min(1).optional(),
});

const RecoverSchema = z.object({
  action: z.enum(['retry', 'safe_retreat', 'force_quit']),
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
});

router.post('/start', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { mapNodeId } = StartSchema.parse(await c.req.json());
  const [tasks, bundle] = await Promise.all([
    TaskService.listCultivatorTasks(cultivator.id),
    getCultivatorByIdUnsafe(cultivator.id),
  ]);
  if (!bundle) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const firstDungeonTask = tasks.find(
    (task) => task.definitionId === 'tutorial_first_dungeon',
  );
  const selectedNode = getMapNode(mapNodeId);
  const selectedNodeRealm =
    selectedNode && 'realm_requirement' in selectedNode
      ? selectedNode.realm_requirement
      : null;
  const display = getCultivatorDisplaySnapshot(bundle.cultivator);
  const readiness = evaluateNoviceReadiness({
    cultivator: bundle.cultivator,
    selectedNodeRealm,
    hp: display.resources.hp,
    mp: display.resources.mp,
    isFirstDungeonTutorialActive: Boolean(
      firstDungeonTask && !firstDungeonTask.snapshot.isCompleted,
    ),
  });

  if (readiness.shouldBlock) {
    return c.json(
      {
        error: readiness.reasons.join('；'),
        readiness,
      },
      409,
    );
  }

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
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { choiceId, actionId } = ActionSchema.parse(await c.req.json());
    const result = await dungeonService.handleAction(
      cultivator.id,
      choiceId,
      actionId,
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '副本推进失败';
    const status = /不足|没有符合条件|资源消耗失败/.test(message) ? 409 : 500;
    return c.json({ error: message }, status);
  }
});

router.post('/recover', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { action } = RecoverSchema.parse(await c.req.json());
    const result = await dungeonService.recoverDungeon(cultivator.id, action);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '副本恢复失败';
    return c.json({ error: message }, 500);
  }
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

battleRouter.get('/probe', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { battleId } = BattleIdQuerySchema.parse({
      battleId: c.req.query('battleId'),
    });
    const enemy = await dungeonService.probeBattleEnemy(cultivator.id, battleId);
    return c.json({
      success: true,
      enemy,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '遭遇战查探失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

battleRouter.post('/abandon', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { battleId } = BattleIdBodySchema.parse(await c.req.json());
    const result = await dungeonService.abandonBattle(cultivator.id, battleId);
    return c.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '放弃遭遇战失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

battleRouter.post('/execute/v5', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { battleId } = BattleIdBodySchema.parse(await c.req.json());
    const result = await dungeonService.executeBattle(cultivator.id, battleId);
    return c.json({
      battleResult: result.battleResult,
      callbackData: {
        dungeonState: result.state,
        roundData: result.roundData,
        isFinished: result.isFinished,
        settlement: result.settlement,
        realGains: result.realGains,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '遭遇战执行失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

router.route('/history', historyRouter);
router.route('/limit', limitRouter);
router.route('/looting', lootingRouter);
router.route('/battle', battleRouter);

export default router;
