import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { InventoryError } from '@server/lib/services/InventoryService';
import { CombatV6BuildError } from '@server/lib/services/combat-v6/CombatV6BuildService';
import {
  advanceTower,
  changeTowerBattle,
  completeTower,
  getTowerBattle,
  getTowerView,
  startTower,
  TowerV6Error,
} from '@server/lib/tower/combatV6';
import { getTowerLeaderboard } from '@server/lib/tower/leaderboard';
import { CombatAutoRequestSchema } from '@shared/combat-v6/auto';
import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@shared/contracts/combatV6';
import { TOWER_BLESSING_IDS } from '@shared/lib/tower/blessings';
import { TOWER_ELIGIBLE_REALMS } from '@shared/lib/tower/helpers';
import { getTowerSeasonMeta } from '@shared/lib/tower/season';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());
router.post('/battle/sessions/:id/auto', async (c) => {
  const input = CombatAutoRequestSchema.parse(await c.req.json());
  const id = z.uuid().parse(c.req.param('id'));
  try {
    return c.json({
      success: true,
      data: await changeTowerBattle(
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
});

router.onError((error, c) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return c.json({ error: '幻境请求参数无效' }, 400);
  if (
    error instanceof TowerV6Error ||
    error instanceof InventoryError ||
    error instanceof CombatV6BuildError
  )
    return c.json({ error: error.message }, 409);
  console.error('[tower-v6] request failed', error);
  return c.json({ error: '幻境操作失败，请刷新后重试' }, 500);
});
router.get('/state', async (c) =>
  c.json({
    success: true,
    data: await getTowerView(c.get('activeCultivatorRef')!.cultivatorId),
  }),
);
router.post('/start', async (c) =>
  c.json({
    success: true,
    data: await startTower(c.get('activeCultivatorRef')!.cultivatorId),
  }),
);
const actionSchema = z.object({
  runId: z.uuid(),
  revision: z.number().int().min(0),
  action: z.enum(['battle', 'blessing', 'leave', 'complete']),
  blessingId: z.enum(TOWER_BLESSING_IDS).optional(),
});
router.post('/action', async (c) => {
  const input = actionSchema.parse(await c.req.json());
  const owner = c.get('activeCultivatorRef')!.cultivatorId;
  const data =
    input.action === 'complete'
      ? await completeTower(
          { userId: c.get('user')!.id, cultivatorId: owner },
          input,
        )
      : await advanceTower(owner, input);
  return c.json({ success: true, data });
});
router.get('/leaderboard', async (c) => {
  const realm = z.enum(TOWER_ELIGIBLE_REALMS).parse(c.req.query('realm'));
  const season = getTowerSeasonMeta();
  return c.json({
    success: true,
    data: await getTowerLeaderboard({
      seasonKey: season.seasonKey,
      seasonEndAt: season.seasonEndsAt,
      realm,
      limit: 30,
      selfCultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
    }),
  });
});
router.get('/battle/sessions/current', async (c) =>
  c.json({
    success: true,
    data: await getTowerBattle(c.get('activeCultivatorRef')!.cultivatorId),
  }),
);
router.get('/battle/sessions/:id', async (c) => {
  const query = CombatV6TrainingEventsQuerySchema.parse(c.req.query());
  const data = await getTowerBattle(
    c.get('activeCultivatorRef')!.cultivatorId,
    z.uuid().parse(c.req.param('id')),
    query.afterEventSeq,
  );
  return data
    ? c.json({ success: true, data })
    : c.json({ error: '战斗不存在' }, 404);
});
router.put('/battle/sessions/:id/commands/:unitId', async (c) => {
  const input = CombatV6TrainingCommandRequestSchema.parse(await c.req.json());
  const data = await changeTowerBattle(
    {
      userId: c.get('user')!.id,
      cultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
    },
    z.uuid().parse(c.req.param('id')),
    input.expectedRevision,
    { unitId: c.req.param('unitId'), commands: input.commands },
  );
  return c.json({ success: true, data });
});
router.post('/battle/sessions/:id/resolve', async (c) => {
  const input = CombatV6TrainingRevisionRequestSchema.parse(await c.req.json());
  const data = await changeTowerBattle(
    {
      userId: c.get('user')!.id,
      cultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
    },
    z.uuid().parse(c.req.param('id')),
    input.expectedRevision,
  );
  return c.json({ success: true, data });
});
router.all('/battle/*', (c) =>
  c.json({ error: '旧幻境战斗已下线，请刷新页面' }, 410),
);
router.post('/reset', (c) =>
  c.json({ error: '旧幻境接口已下线，请刷新页面' }, 410),
);
router.post('/blessing/choose', (c) =>
  c.json({ error: '旧幻境接口已下线，请刷新页面' }, 410),
);
export default router;
