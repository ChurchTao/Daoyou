import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  changeBreakthroughBattle,
  getBreakthroughBattle,
} from '@server/lib/services/combat-v6/CombatV6BreakthroughService';
import { CombatAutoRequestSchema } from '@shared/combat-v6/auto';
import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@shared/contracts/combatV6';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());
router.onError((error, c) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  return c.json(
    { error: error instanceof z.ZodError ? '突破战斗参数无效' : error.message },
    error instanceof z.ZodError ? 400 : 409,
  );
});
router.get('/tasks/:taskId/sessions/current', async (c) =>
  c.json({
    success: true,
    data: await getBreakthroughBattle(
      c.get('activeCultivatorRef')!.cultivatorId,
      z.uuid().parse(c.req.param('taskId')),
    ),
  }),
);
router.get('/tasks/:taskId/sessions/:id', async (c) => {
  const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
  return c.json({
    success: true,
    data: await getBreakthroughBattle(
      c.get('activeCultivatorRef')!.cultivatorId,
      z.uuid().parse(c.req.param('taskId')),
      z.uuid().parse(c.req.param('id')),
      query.afterEventSeq,
    ),
  });
});
router.put('/tasks/:taskId/sessions/:id/commands/:unitId', async (c) => {
  const input = CombatV6TrainingCommandRequestSchema.parse(await c.req.json());
  return c.json({
    success: true,
    data: await changeBreakthroughBattle(
      c.get('activeCultivatorRef')!,
      z.uuid().parse(c.req.param('taskId')),
      z.uuid().parse(c.req.param('id')),
      input.expectedRevision,
      { unitId: c.req.param('unitId'), commands: input.commands },
    ),
  });
});
router.post('/tasks/:taskId/sessions/:id/resolve', async (c) => {
  const input = CombatV6TrainingRevisionRequestSchema.parse(await c.req.json());
  return c.json({
    success: true,
    data: await changeBreakthroughBattle(
      c.get('activeCultivatorRef')!,
      z.uuid().parse(c.req.param('taskId')),
      z.uuid().parse(c.req.param('id')),
      input.expectedRevision,
    ),
  });
});
router.post('/tasks/:taskId/sessions/:id/auto', async (c) => {
  const input = CombatAutoRequestSchema.parse(await c.req.json());
  return c.json({
    success: true,
    data: await changeBreakthroughBattle(
      c.get('activeCultivatorRef')!,
      z.uuid().parse(c.req.param('taskId')),
      z.uuid().parse(c.req.param('id')),
      input.expectedRevision,
      undefined,
      input.round,
    ),
  });
});
export default router;
