import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import {
  CombatV6BuildError,
  getCombatV6BuildView,
  initializeCombatV6Build,
} from '@server/lib/services/combat-v6/CombatV6BuildService';
import {
  COMBAT_V6_TRAINING_CONTENT_VIEW,
  CombatV6TrainingSessionError,
  combatV6TrainingSessionStore,
} from '@server/lib/services/combat-v6/CombatV6TrainingSessionService';
import { CombatV6RuntimeStore } from '@server/lib/services/combat-v6/CombatV6RuntimeStore';
import { findOwnedCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository';
import {
  CombatV6BuildInitializeRequestSchema,
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingCommandParamsSchema,
  CombatV6TrainingCreateRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
  CombatV6TrainingSessionParamsSchema,
  CombatV6ReplayParamsSchema,
  COMBAT_V6_REPLAY_ERROR_CODE,
} from '@shared/contracts/combatV6';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const combatV6RuntimeStore = new CombatV6RuntimeStore();
router.use('*', requireActiveCultivatorRef());

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
    { success: false, code: 'COMBAT_V6_INTERNAL_ERROR', error: '练功房暂不可用，请稍后再试' },
    500,
  );
}

router.get('/build', async (c) => {
  try {
    const current = actor(c);
    return c.json(
      await readResourceWithMeta(
        { kind: 'cultivator', id: current.cultivatorId },
        'player.combat-v6-build',
        (tx) => getCombatV6BuildView(current.cultivatorId, tx),
      ),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/build/initialize', async (c) => {
  try {
    const input = CombatV6BuildInitializeRequestSchema.parse(await c.req.json());
    return c.json(
      toPlayerStateMutationResponse(await initializeCombatV6Build(actor(c), input)),
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
    const params = CombatV6ReplayParamsSchema.parse(c.req.param());
    const current = actor(c);
    const archived = await findOwnedCombatV6Replay(params.battleId, current.cultivatorId);
    if (archived) return c.json({ success: true, data: archived.replay });
    const runtime = await combatV6RuntimeStore.get(params.battleId);
    if (runtime?.cultivatorId === current.cultivatorId && runtime.host.state.result) {
      return c.json({ success: false, code: COMBAT_V6_REPLAY_ERROR_CODE.Pending, error: '战斗回放正在归档' }, 202);
    }
    return c.json({ success: false, code: COMBAT_V6_REPLAY_ERROR_CODE.NotFound, error: '战斗回放不存在' }, 404);
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.get('/training/sessions/current', async (c) => {
  try {
    const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.current(actor(c), query.afterEventSeq),
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
    const input = CombatV6TrainingCommandRequestSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.submit(
        actor(c),
        params.sessionId,
        input.expectedRevision,
        params.unitId,
        input.command,
      ),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/training/sessions/:sessionId/resolve', async (c) => {
  try {
    const params = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    const input = CombatV6TrainingRevisionRequestSchema.parse(await c.req.json());
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
    const input = CombatV6TrainingRevisionRequestSchema.parse(await c.req.json());
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
    return c.json({ success: false, code: 'TRAINING_SESSION_NOT_FOUND', error: '训练会话不存在' }, 404);
  }
  try {
    const params = CombatV6TrainingSessionParamsSchema.parse(c.req.param());
    return c.json({
      success: true,
      data: await combatV6TrainingSessionStore.trace(actor(c), params.sessionId),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
