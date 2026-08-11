import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getHerbGardenState,
  harvestAllReadyHerbs,
  harvestHerb,
  helpFriendPlot,
  HerbGardenError,
  plantHerb,
  stealFriendHerb,
} from '@server/lib/services/HerbGardenService';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

const PlantSchema = z.object({
  slot: z.number().int().min(1).max(6),
  seedMaterialId: z.string().uuid(),
});

const PlotIdSchema = z.object({ plotId: z.string().uuid() });
const VisitSchema = z.object({
  ownerId: z.string().uuid(),
  plotId: z.string().uuid(),
});

function handleError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof z.ZodError) {
    return c.json({ error: '参数错误', details: error.issues }, 400);
  }
  if (error instanceof HerbGardenError) {
    return jsonWithStatus(c, { error: error.message }, error.status);
  }
  console.error('[herb-garden] api error', error);
  return c.json({ error: '灵药圃暂时无法响应，请稍后再试' }, 500);
}

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const garden = await getHerbGardenState(cultivator.cultivatorId);
    return c.json({ garden });
  } catch (error) {
    return handleError(c, error);
  }
});

router.get('/visit/:ownerId', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const ownerId = z.string().uuid().parse(c.req.param('ownerId'));
    const garden = await getHerbGardenState(cultivator.cultivatorId, ownerId);
    return c.json({ garden });
  } catch (error) {
    return handleError(c, error);
  }
});

router.post('/plant', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const input = PlantSchema.parse(await c.req.json());
    await plantHerb(cultivator.cultivatorId, input);
    const garden = await getHerbGardenState(cultivator.cultivatorId);
    return c.json({ garden, message: '灵种已入土，静候草木生发。' });
  } catch (error) {
    return handleError(c, error);
  }
});

router.post('/plots/:plotId/harvest', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const { plotId } = PlotIdSchema.parse({ plotId: c.req.param('plotId') });
    const result = await harvestHerb(cultivator.cultivatorId, plotId);
    const garden = await getHerbGardenState(cultivator.cultivatorId);
    return c.json({ result, garden });
  } catch (error) {
    return handleError(c, error);
  }
});

router.post('/harvest-all', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const results = await harvestAllReadyHerbs(cultivator.cultivatorId);
    const garden = await getHerbGardenState(cultivator.cultivatorId);
    return c.json({ results, garden });
  } catch (error) {
    return handleError(c, error);
  }
});

router.post(
  '/visit/:ownerId/plots/:plotId/help',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) return c.json({ error: '未授权访问' }, 401);
    try {
      const input = VisitSchema.parse({
        ownerId: c.req.param('ownerId'),
        plotId: c.req.param('plotId'),
      });
      await helpFriendPlot(cultivator.cultivatorId, input.ownerId, input.plotId);
      const garden = await getHerbGardenState(cultivator.cultivatorId, input.ownerId);
      return c.json({ garden, message: '你引来一缕灵气，替道友照料了这株灵植。' });
    } catch (error) {
      return handleError(c, error);
    }
  },
);

router.post(
  '/visit/:ownerId/plots/:plotId/steal',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) return c.json({ error: '未授权访问' }, 401);
    try {
      const input = VisitSchema.parse({
        ownerId: c.req.param('ownerId'),
        plotId: c.req.param('plotId'),
      });
      const result = await stealFriendHerb(
        cultivator.cultivatorId,
        input.ownerId,
        input.plotId,
      );
      const garden = await getHerbGardenState(cultivator.cultivatorId, input.ownerId);
      return c.json({ result, garden });
    } catch (error) {
      return handleError(c, error);
    }
  },
);

export default router;
