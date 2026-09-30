import {
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { isRedisLockContention } from '@server/lib/redis/lock';
import { ArenaV6Error } from '@server/lib/services/combat-v6/CombatV6ArenaService';
import { huntBattleReward } from '@server/lib/services/hunts/HuntRewardProjector';
import {
  commandHuntTeam,
  createHuntTeam,
  huntLobby,
  joinHuntTeam,
} from '@server/lib/services/hunts/HuntTeamService';
import {
  HuntCreateTeamSchema,
  HuntEventIdSchema,
  HuntTeamCommandSchema,
  type HuntTeamCommand,
} from '@shared/contracts/hunts';
import { huntEventsAt } from '@shared/hunts/config';
import { Hono } from 'hono';
import { z } from 'zod';
const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());
router.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  await next();
});
router.onError((error, c) => {
  if (error instanceof ArenaV6Error)
    return c.json({ success: false, error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return c.json(
      { success: false, error: '未能完成操作，请刷新后再试' },
      400,
    );
  if (isRedisLockContention(error))
    return c.json(
      { success: false, error: '队伍正忙，请稍后再试' },
      409,
    );
  console.error('[hunt] request failed', error);
  return c.json(
    { success: false, error: '暂时联系不上讨伐队伍，请稍后再试' },
    500,
  );
});
router.get('/', (c) =>
  c.json({
    success: true,
    data: { events: huntEventsAt(Date.now()), serverNow: Date.now() },
  }),
);
router.get('/battles/:battleId/reward', async (c) =>
  c.json({
    success: true,
    data: await huntBattleReward(
      z.uuid().parse(c.req.param('battleId')),
      c.get('activeCultivatorRef')!,
    ),
  }),
);
router.get('/:eventId', async (c) =>
  c.json({
    success: true,
    data: await huntLobby(
      HuntEventIdSchema.parse(c.req.param('eventId')),
      c.get('activeCultivatorRef')!,
    ),
  }),
);
router.post('/teams', validateJson(HuntCreateTeamSchema), async (c) =>
  c.json({
    success: true,
    data: await createHuntTeam(
      c.get('activeCultivatorRef')!,
      c.get('validatedJson') as z.infer<typeof HuntCreateTeamSchema>,
    ),
  }),
);
router.post(
  '/:eventId/join',
  validateJson(z.object({ teamId: z.uuid().optional() }).strict()),
  async (c) =>
    c.json({
      success: true,
      data: await joinHuntTeam(
        c.get('activeCultivatorRef')!,
        HuntEventIdSchema.parse(c.req.param('eventId')),
        (c.get('validatedJson') as { teamId?: string }).teamId,
      ),
    }),
);
router.post('/teams/:teamId', validateJson(HuntTeamCommandSchema), async (c) =>
  c.json({
    success: true,
    data: await commandHuntTeam(
      c.get('activeCultivatorRef')!,
      z.uuid().parse(c.req.param('teamId')),
      c.get('validatedJson') as HuntTeamCommand,
    ),
  }),
);
export default router;
