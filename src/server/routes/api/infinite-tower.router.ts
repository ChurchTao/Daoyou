import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { infiniteTowerService } from '@server/lib/infiniteTower/service';
import {
  executeInfiniteTowerBattleCommand,
  executeInfiniteTowerProbeCommand,
} from '@server/lib/services/InfiniteTowerApplicationService';
import {
  InfiniteTowerBattleIdSchema as BattleIdSchema,
  InfiniteTowerLeaderboardQuerySchema as LeaderboardQuerySchema,
} from '@shared/contracts/infiniteTower';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/state', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);
  return c.json({
    state: await infiniteTowerService.getState(cultivator.cultivatorId),
  });
});

router.get('/leaderboard', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);
    const { realm, limit } = LeaderboardQuerySchema.parse({
      realm: c.req.query('realm'),
      limit: c.req.query('limit'),
    });
    return c.json({
      entries: await infiniteTowerService.getLeaderboard(
        cultivator.cultivatorId,
        realm,
        limit,
      ),
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : '读取通天塔排行榜失败',
      },
      400,
    );
  }
});

router.post('/battle/probe', requireActiveCultivatorRef(), async (c) => {
  try {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) return c.json({ error: '当前没有活跃角色' }, 404);
    const result = await executeInfiniteTowerProbeCommand(
      cultivator.cultivatorId,
    );
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '照见守塔者失败' },
      400,
    );
  }
});

router.get('/battle/context', requireActiveCultivatorRef(), async (c) => {
  try {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);
    const { battleId } = BattleIdSchema.parse({
      battleId: c.req.query('battleId'),
    });
    return c.json(
      await infiniteTowerService.getBattleContext(
        cultivator.cultivatorId,
        battleId,
      ),
    );
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '读取通天塔战局失败' },
      400,
    );
  }
});

router.post('/battle/execute/v6', requireActiveCultivatorRef(), async (c) => {
  try {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);
    const { battleId } = BattleIdSchema.parse(await c.req.json());
    const result = await executeInfiniteTowerBattleCommand({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
      battleId,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '通天塔战局执行失败' },
      400,
    );
  }
});

export default router;
