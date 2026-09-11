import { db } from '@server/lib/drizzle/db';
import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { readBeastRoster } from '@server/lib/repositories/combatV6BeastRepository';
import {
  findOwnedCombatV6Replay,
  listOwnedCombatV6Replays,
} from '@server/lib/repositories/combatV6ReplayRepository';
import {
  InventoryError,
  mutateInventory,
  readInventory,
} from '@server/lib/services/InventoryService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import { CombatV6ArenaStore } from '@server/lib/services/combat-v6/CombatV6ArenaStore';
import {
  BeastError,
  allocateBeastPoints,
  claimStarterBeast,
  releaseBeast,
  restBeast,
  updateBeastLineup,
} from '@server/lib/services/combat-v6/CombatV6BeastService';
import {
  CombatV6BuildError,
  getSectCombatView,
  selectInitialSectPath,
} from '@server/lib/services/combat-v6/CombatV6BuildService';
import { CombatV6RuntimeStore } from '@server/lib/services/combat-v6/CombatV6RuntimeStore';
import {
  COMBAT_V6_TRAINING_CONTENT_VIEW,
  CombatV6TrainingSessionError,
  combatV6TrainingSessionStore,
} from '@server/lib/services/combat-v6/CombatV6TrainingSessionService';
import {
  WildError,
  wildSessions,
} from '@server/lib/services/combat-v6/CombatV6WildSessionService';
import { CombatAutoRequestSchema } from '@shared/combat-v6/auto';
import { combatV6ReplayView } from '@shared/combat-v6/replay';
import {
  COMBAT_V6_REPLAY_ERROR_CODE,
  SectPathSelectionRequestSchema,
  CombatV6ReplayParamsSchema,
  CombatV6TrainingCommandParamsSchema,
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingCreateRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
  CombatV6TrainingSessionParamsSchema,
} from '@shared/contracts/combatV6';
import {
  BeastAllocateSchema,
  BeastClaimSchema,
  BeastLineupRequestSchema,
  BeastRestSchema,
} from '@shared/contracts/combatV6Beasts';
import { CombatV6HistoryQuerySchema } from '@shared/contracts/combatV6Replay';
import { WildExploreRequestSchema } from '@shared/contracts/combatV6Wild';
import {
  InventoryActionSchema,
  InventoryQuerySchema,
} from '@shared/contracts/inventory';
import { TrainingHostError } from '@shared/engine/combat-v6/encounter';
import { InventoryRuleError } from '@shared/inventory';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const combatV6RuntimeStore = new CombatV6RuntimeStore();
const arenaReplayStore = new CombatV6ArenaStore();
router.use('*', requireActiveCultivatorRef());
router.post('/wild/sessions/:id/auto', async (c) => {
  const input = CombatAutoRequestSchema.parse(await c.req.json());
  const id = z.uuid().parse(c.req.param('id'));
  try {
    return c.json({
      success: true,
      data: await wildSessions.resolve(
        c.get('activeCultivatorRef')!,
        id,
        input.expectedRevision,
        input.round,
      ),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '自动指令提交失败' },
      409,
    );
  }
});

router.post('/training/sessions/:id/auto', async (c) => {
  const input = CombatAutoRequestSchema.parse(await c.req.json());
  const id = z.uuid().parse(c.req.param('id'));
  try {
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.resolve(
        c.get('activeCultivatorRef')!,
        id,
        input.expectedRevision,
        input.round,
      ),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '自动指令提交失败' },
      409,
    );
  }
});

function actor(c: Context<AppEnv>) {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    throw new CombatV6BuildError(
      'COMBAT_V6_ACTIVE_MEMBERSHIP_REQUIRED',
      '当前没有活跃角色',
      404,
    );
  }
  return { userId: ref.userId, cultivatorId: ref.cultivatorId };
}

function errorResponse(c: Context<AppEnv>, error: unknown) {
  if (error instanceof InventoryError || error instanceof InventoryRuleError)
    return c.json({ success: false, error: error.message }, 409);
  if (error instanceof BeastError)
    return c.json({ success: false, error: error.message }, error.status);
  const coordinationError = redisLockErrorResponse(error);
  if (coordinationError) return coordinationError;
  if (error instanceof TrainingHostError)
    return c.json(
      {
        success: false,
        code: 'WILD_COMMAND_NOT_ALLOWED',
        error: error.message,
      },
      400,
    );
  if (error instanceof z.ZodError) {
    return c.json(
      {
        success: false,
        code: 'INVALID_REQUEST',
        error: error.issues[0]?.message ?? '参数错误',
        details: error.issues,
      },
      400,
    );
  }
  if (
    error instanceof CombatV6BuildError ||
    error instanceof WildError ||
    error instanceof CombatV6TrainingSessionError
  ) {
    return jsonWithStatus(
      c,
      { success: false, code: error.code, error: error.message },
      error.status,
    );
  }
  console.error('combat-v6 api error:', error);
  return c.json(
    {
      success: false,
      code: 'COMBAT_V6_INTERNAL_ERROR',
      error: '练功房暂不可用，请稍后再试',
    },
    500,
  );
}

router.get('/inventory', async (c) => {
  c.header('Cache-Control', 'no-store');
  try {
    return c.json({
      success: true,
      data: await readInventory(
        actor(c).cultivatorId,
        InventoryQuerySchema.parse(c.req.query()),
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.post('/inventory', async (c) => {
  try {
    return c.json({
      success: true,
      data: await mutateInventory(
        actor(c).cultivatorId,
        InventoryActionSchema.parse(await c.req.json()),
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.get('/beasts', async (c) => {
  c.header('Cache-Control', 'no-store');
  try {
    return c.json({
      success: true,
      data: await readBeastRoster(actor(c).cultivatorId, db),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.post('/beasts/claim', async (c) => {
  try {
    const input = BeastClaimSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await claimStarterBeast(actor(c).cultivatorId, input.speciesId),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.put('/beasts/lineup', async (c) => {
  try {
    return c.json({
      success: true,
      data: await updateBeastLineup(
        actor(c).cultivatorId,
        BeastLineupRequestSchema.parse(await c.req.json()),
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.post('/beasts/rest', async (c) => {
  try {
    const input = BeastRestSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await restBeast(
        actor(c).cultivatorId,
        input.beastId,
        input.expectedRevision,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/beasts/allocate', async (c) => {
  try {
    const input = BeastAllocateSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await allocateBeastPoints(
        actor(c).cultivatorId,
        input.beastId,
        input.expectedRevision,
        input.points,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.post('/beasts/release', async (c) => {
  try {
    const input = BeastRestSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await releaseBeast(
        actor(c).cultivatorId,
        input.beastId,
        input.expectedRevision,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/sect/state', async (c) => {
  try {
    const current = actor(c);
    return c.json(
      await readResourceWithMeta(
        { kind: 'cultivator', id: current.cultivatorId },
        'player.sect-combat',
        (tx) => getSectCombatView(current.cultivatorId, tx),
      ),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/sect/path', async (c) => {
  try {
    const input = SectPathSelectionRequestSchema.parse(
      await c.req.json(),
    );
    return c.json(
      toPlayerStateMutationResponse(
        await selectInitialSectPath(actor(c), input),
      ),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/training/content', (c) =>
  c.json({ success: true, data: COMBAT_V6_TRAINING_CONTENT_VIEW }),
);

router.get('/replays/:battleId', async (c) => {
  try {
    c.header('Cache-Control', 'private, no-store');
    const params = CombatV6ReplayParamsSchema.parse(c.req.param());
    const current = actor(c);
    const archived = await findOwnedCombatV6Replay(
      params.battleId,
      current.cultivatorId,
    );
    if (
      archived &&
      archived.replay.participants.some(
        (p) =>
          p.cultivatorId === current.cultivatorId &&
          p.userId === current.userId,
      )
    )
      return c.json({
        success: true,
        data: combatV6ReplayView(
          archived.replay,
          current.cultivatorId,
          current.userId,
        ),
      });
    const arena = await arenaReplayStore.get(params.battleId);
    if (
      arena?.stage === 'finished' &&
      arena.participants.some(
        (p) =>
          p.userId === current.userId &&
          p.cultivatorId === current.cultivatorId,
      )
    )
      return c.json(
        {
          success: false,
          code: COMBAT_V6_REPLAY_ERROR_CODE.Pending,
          error: '战斗回放正在归档，请稍后重试',
        },
        202,
      );
    const terminal = await combatV6RuntimeStore.terminalRecord(params.battleId);
    if (
      terminal?.cultivatorId === current.cultivatorId &&
      terminal.replayExpected
    )
      return c.json(
        {
          success: false,
          code: COMBAT_V6_REPLAY_ERROR_CODE.Pending,
          error: '战斗回放正在归档',
        },
        202,
      );
    const runtime = await combatV6RuntimeStore.get(params.battleId);
    if (
      runtime?.cultivatorId === current.cultivatorId &&
      runtime.host.state.result
    ) {
      return c.json(
        {
          success: false,
          code: COMBAT_V6_REPLAY_ERROR_CODE.Pending,
          error: '战斗回放正在归档',
        },
        202,
      );
    }
    return c.json(
      {
        success: false,
        code: COMBAT_V6_REPLAY_ERROR_CODE.NotFound,
        error: '战斗回放不存在',
      },
      404,
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/replays', async (c) => {
  try {
    const query = CombatV6HistoryQuerySchema.parse(c.req.query());
    c.header('Cache-Control', 'private, no-store');
    return c.json({
      success: true,
      data: await listOwnedCombatV6Replays(actor(c).cultivatorId, query),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/training/sessions/current', async (c) => {
  try {
    const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.current(
        actor(c),
        query.afterEventSeq,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/training/sessions', async (c) => {
  try {
    const input = CombatV6TrainingCreateRequestSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.create(
        actor(c),
        input.encounterId,
        input.tier,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/training/sessions/:sessionId', async (c) => {
  try {
    const params = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.get(
        actor(c),
        params.sessionId,
        query.afterEventSeq,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.put('/training/sessions/:sessionId/commands/:unitId', async (c) => {
  try {
    const params = CombatV6TrainingCommandParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingCommandRequestSchema.parse(
      await c.req.json(),
    );
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.submit(
        actor(c),
        params.sessionId,
        input.expectedRevision,
        params.unitId,
        input.commands,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/training/sessions/:sessionId/resolve', async (c) => {
  try {
    const params = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingRevisionRequestSchema.parse(
      await c.req.json(),
    );
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.resolve(
        actor(c),
        params.sessionId,
        input.expectedRevision,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.delete('/training/sessions/:sessionId', async (c) => {
  try {
    const params = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingRevisionRequestSchema.parse(
      await c.req.json(),
    );
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.abandon(
        actor(c),
        params.sessionId,
        input.expectedRevision,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/training/sessions/:sessionId/trace', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json(
      {
        success: false,
        code: 'TRAINING_SESSION_NOT_FOUND',
        error: '训练会话不存在',
      },
      404,
    );
  }
  try {
    const params = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.trace(
        actor(c),
        params.sessionId,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/wild/regions/:nodeId', async (c) => {
  try {
    return c.json({
      success: true,
      data: await wildSessions.region(actor(c), c.req.param('nodeId')),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.post('/wild/explorations', async (c) => {
  try {
    const input = WildExploreRequestSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await wildSessions.explore(actor(c), input.nodeId, input.requestId),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.get('/wild/sessions/current', async (c) => {
  try {
    return c.json({
      success: true,
      data: await wildSessions.current(actor(c)),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.get('/wild/sessions/:sessionId', async (c) => {
  try {
    const { sessionId } = CombatV6TrainingSessionParamsSchema.parse(
      c.req.param(),
    );
    const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
    return c.json({
      success: true,
      data: await wildSessions.get(actor(c), sessionId, query.afterEventSeq),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.put('/wild/sessions/:sessionId/commands/:unitId', async (c) => {
  try {
    const p = CombatV6TrainingCommandParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingCommandRequestSchema.parse(
      await c.req.json(),
    );
    return c.json({
      success: true,
      data: await wildSessions.submit(
        actor(c),
        p.sessionId,
        input.expectedRevision,
        p.unitId,
        input.commands,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.post('/wild/sessions/:sessionId/resolve', async (c) => {
  try {
    const p = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingRevisionRequestSchema.parse(
      await c.req.json(),
    );
    return c.json({
      success: true,
      data: await wildSessions.resolve(
        actor(c),
        p.sessionId,
        input.expectedRevision,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
router.delete('/wild/sessions/:sessionId', async (c) => {
  try {
    const p = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingRevisionRequestSchema.parse(
      await c.req.json(),
    );
    return c.json({
      success: true,
      data: await wildSessions.abandon(
        actor(c),
        p.sessionId,
        input.expectedRevision,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
