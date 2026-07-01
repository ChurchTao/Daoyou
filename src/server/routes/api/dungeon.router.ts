import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { cultivators, dungeonHistories } from '@server/lib/drizzle/schema';
import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  checkDungeonLimit,
  getDungeonLimitConfig,
} from '@server/lib/dungeon/dungeonLimiter';
import {
  DungeonFlowError,
  dungeonService,
} from '@server/lib/dungeon/service_v2';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { redis } from '@server/lib/redis';
import { TaskService } from '@server/lib/services/TaskService';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
  type StateChangeDescriptor,
} from '@server/lib/services/PlayerStateMutationService';
import { hasCultivatorRecoveryPill } from '@server/lib/repositories/cultivatorRepository';
import {
  buildCultivatorRuntime,
  getPlayerLoadoutByCultivatorId,
  getPlayerProfileCultivatorById,
} from '@server/lib/services/cultivatorService';
import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import { getCultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import {
  canChallengeDungeonRealm,
  getMapNode,
  isSatelliteNode,
} from '@shared/lib/game/mapSystem';
import { evaluateNoviceReadiness } from '@shared/lib/noviceGuidance';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { CultivationProgress } from '@shared/types/cultivator';
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

type DungeonResultHooks = {
  persist?: (tx: DbTransaction) => Promise<void>;
  afterCommit?: () => Promise<void>;
};

function getDungeonBattleResultCacheKey(args: {
  cultivatorId: string;
  battleId: string;
  requestId: string;
}) {
  return `dungeon:battle-result:${args.cultivatorId}:${args.battleId}:${args.requestId}`;
}

type DungeonPlayerStateRow = {
  condition: unknown;
  spiritStones: number;
  qi: number;
  qiLastRefreshedAt: Date | null;
  cultivationProgress: unknown;
  realm: RealmType;
  realmStage: RealmStage;
};

async function readDungeonPlayerState(
  tx: DbTransaction,
  cultivatorId: string,
): Promise<DungeonPlayerStateRow | null> {
  const [row] = await tx
    .select({
      condition: cultivators.condition,
      spiritStones: cultivators.spirit_stones,
      qi: cultivators.qi,
      qiLastRefreshedAt: cultivators.qiLastRefreshedAt,
      cultivationProgress: cultivators.cultivation_progress,
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    realm: row.realm as RealmType,
    realmStage: row.realmStage as RealmStage,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function buildDungeonStateChanges(args: {
  before: DungeonPlayerStateRow | null;
  after: DungeonPlayerStateRow | null;
  result: unknown;
  includeTasks?: boolean;
}): StateChangeDescriptor[] {
  const changes: StateChangeDescriptor[] = [];
  const { before, after } = args;

  if (after && stableJson(before?.condition) !== stableJson(after.condition)) {
    changes.push({
      domain: 'condition',
      eventType: 'condition.changed',
      patch: { condition: after.condition },
    });
  }

  if (
    after &&
    (before?.spiritStones !== after.spiritStones ||
      before?.qi !== after.qi ||
      before?.qiLastRefreshedAt?.toISOString() !==
        after.qiLastRefreshedAt?.toISOString())
  ) {
    changes.push({
      domain: 'currency',
      eventType: 'currency.changed',
      patch: {
        currency: {
          spiritStones: after.spiritStones,
          qi: after.qi,
          qiLastRefreshedAt: after.qiLastRefreshedAt?.toISOString() ?? null,
        },
      },
    });
  }

  if (
    after &&
    stableJson(before?.cultivationProgress) !==
      stableJson(after.cultivationProgress)
  ) {
    changes.push({
      domain: 'progress',
      eventType: 'progress.changed',
      patch: {
        progress: getOrInitCultivationProgress(
          (after.cultivationProgress ?? {}) as CultivationProgress,
          after.realm,
          after.realmStage,
        ),
      },
    });
  }

  if (args.includeTasks) {
    changes.push({
      domain: 'tasks',
      eventType: 'tasks.changed',
      invalidates: ['tasks'],
    });
  }

  return changes;
}

async function commitDungeonResponse<T>(args: {
  userId: string;
  cultivatorId: string;
  source: string;
  result: T;
  includeTasks?: boolean;
  requestId?: string | null;
}) {
  const resultWithHooks =
    args.result && typeof args.result === 'object'
      ? (args.result as T & {
          persist?: (tx: DbTransaction) => Promise<void>;
          afterCommit?: () => Promise<void>;
        })
      : null;
  const persist = resultWithHooks?.persist;
  const afterCommit = resultWithHooks?.afterCommit;
  const responseResult = resultWithHooks
    ? (() => {
        const rest = { ...(resultWithHooks as Record<string, unknown>) };
        delete rest.persist;
        delete rest.afterCommit;
        return rest as T;
      })()
    : args.result;
  const committed = await commitPlayerStateMutation({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: args.source,
    requestId: args.requestId ?? null,
    allowEmpty: true,
    run: async (tx) => {
      const before = await readDungeonPlayerState(tx, args.cultivatorId);
      if (persist) {
        await persist(tx);
      }
      const after = await readDungeonPlayerState(tx, args.cultivatorId);
      return {
        result: responseResult,
        changes: buildDungeonStateChanges({
          before,
          after,
          result: responseResult,
          includeTasks: args.includeTasks,
        }),
      };
    },
  });
  if (afterCommit) {
    await afterCommit();
  }
  return toPlayerStateMutationResponse(committed);
}

router.post('/start', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { mapNodeId } = StartSchema.parse(await c.req.json());

  // 只有卫星地图可以进行副本挑战，主节点不可以
  if (!isSatelliteNode(mapNodeId)) {
    return c.json({ error: '只有秘境节点可以进行副本挑战' }, 400);
  }

  const [tasks, profile, loadout, hasRecoveryPill] = await Promise.all([
    TaskService.listCultivatorTasks(cultivator.id),
    getPlayerProfileCultivatorById(user.id, cultivator.id),
    getPlayerLoadoutByCultivatorId(cultivator.id),
    hasCultivatorRecoveryPill(cultivator.id),
  ]);
  if (!profile) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }
  const runtimeCultivator = buildCultivatorRuntime(profile, loadout);

  const firstDungeonTask = tasks.find(
    (task) => task.definitionId === 'tutorial_first_dungeon',
  );
  const selectedNode = getMapNode(mapNodeId);
  const selectedNodeRealm =
    selectedNode && 'realm_requirement' in selectedNode
      ? selectedNode.realm_requirement
      : null;
  if (
    selectedNodeRealm &&
    !canChallengeDungeonRealm(runtimeCultivator.realm, selectedNodeRealm)
  ) {
    return c.json(
      {
        error: `当前境界${runtimeCultivator.realm}不可挑战${selectedNodeRealm}副本，请先提升大境界`,
      },
      409,
    );
  }

  const display = getCultivatorDisplaySnapshot(runtimeCultivator);
  const readiness = evaluateNoviceReadiness({
    cultivator: runtimeCultivator,
    selectedNodeRealm,
    hp: display.resources.hp,
    mp: display.resources.mp,
    isFirstDungeonTutorialActive: Boolean(
      firstDungeonTask && !firstDungeonTask.snapshot.isCompleted,
    ),
    hasRecoveryPill,
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

  try {
    const result = await dungeonService.startDungeon(
      cultivator.id,
      mapNodeId,
      { deferPersistence: true },
    );
    return c.json(
      await commitDungeonResponse({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'dungeon_start',
        result,
      }),
    );
  } catch (error) {
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
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { choiceId, actionId } = ActionSchema.parse(await c.req.json());
    const result = await dungeonService.handleAction(
      cultivator.id,
      choiceId,
      actionId,
      { deferPersistence: true },
    );
    return c.json(
      await commitDungeonResponse({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'dungeon_action',
        result,
        includeTasks: 'isFinished' in result && Boolean(result.isFinished),
      }),
    );
  } catch (error) {
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

router.post('/recover', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { action } = RecoverSchema.parse(await c.req.json());
    const result = await dungeonService.recoverDungeon(cultivator.id, action, {
      deferPersistence: true,
    });
    return c.json(
      await commitDungeonResponse({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: `dungeon_recover_${action}`,
        result,
        includeTasks: 'isFinished' in result && Boolean(result.isFinished),
      }),
    );
  } catch (error) {
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

router.post('/quit', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const result = await dungeonService.quitDungeon(cultivator.id, {
    deferPersistence: true,
  });
  return c.json(
    await commitDungeonResponse({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'dungeon_quit',
      result,
    }),
  );
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
  try {
    const cultivator = c.get('cultivator');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const result = await dungeonService.continueFromLooting(cultivator.id, {
      deferPersistence: true,
    });
    return c.json(
      await commitDungeonResponse({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'dungeon_looting_continue',
        result,
        includeTasks: Boolean(result?.isFinished),
      }),
    );
  } catch (error) {
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

lootingRouter.post('/escape', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const result = await dungeonService.escapeFromLooting(cultivator.id, {
      deferPersistence: true,
    });
    return c.json(
      await commitDungeonResponse({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'dungeon_looting_escape',
        result,
        includeTasks: Boolean(result?.isFinished),
      }),
    );
  } catch (error) {
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

battleRouter.get('/probe', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
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
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId } = BattleIdBodySchema.parse(await c.req.json());
    const result = await dungeonService.abandonBattle(cultivator.id, battleId, {
      deferPersistence: true,
    });
    return c.json(
      await commitDungeonResponse({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'dungeon_battle_abandon',
        result,
        includeTasks: Boolean(result?.isFinished),
      }),
    );
  } catch (error) {
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
    const message =
      error instanceof Error ? error.message : '放弃遭遇战失败';
    const status = /遭遇战|修真者/.test(message) ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

battleRouter.post('/execute/v5', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    const user = c.get('user');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId, requestId } = BattleIdBodySchema.parse(await c.req.json());
    const resultCacheKey = requestId
      ? getDungeonBattleResultCacheKey({
          cultivatorId: cultivator.id,
          battleId,
          requestId,
        })
      : null;
    if (resultCacheKey) {
      const cached = await redis.get(resultCacheKey);
      if (cached) {
        return c.json(JSON.parse(cached));
      }
    }

    const result = await dungeonService.executeBattle(cultivator.id, battleId, {
      deferPersistence: true,
    });
    const hooks = result as DungeonResultHooks;
    const responsePayload = await commitDungeonResponse({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'dungeon_battle_execute',
      requestId,
      result: {
        battleResult: result.battleResult,
        callbackData: {
          dungeonState: result.state,
          roundData: result.roundData,
          isFinished: result.isFinished,
          settlement: result.settlement,
          realGains: result.realGains,
        },
        persist: hooks.persist,
        afterCommit: hooks.afterCommit,
      },
      includeTasks: Boolean(result.isFinished),
    });
    if (resultCacheKey) {
      await redis.set(resultCacheKey, JSON.stringify(responsePayload), 'EX', 3600);
    }
    return c.json(responsePayload);
  } catch (error) {
    if (error instanceof DungeonFlowError) {
      return jsonWithStatus(
        c,
        { error: error.message, code: error.code },
        error.status,
      );
    }
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
