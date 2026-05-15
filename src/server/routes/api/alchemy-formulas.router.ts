import {
  confirmDiscoveryCandidate,
  listCultivatorFormulas,
} from '@server/lib/services/AlchemyFormulaService';
import { AlchemyServiceError } from '@server/lib/services/AlchemyServiceError';
import { requireActiveCultivator } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

const DiscoveryConfirmSchema = z.object({
  token: z.string().uuid(),
  accept: z.boolean(),
});

router.get('/formulas', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const formulas = await listCultivatorFormulas(cultivator.id);
    return c.json({
      success: true,
      data: {
        formulas,
      },
    });
  } catch (error) {
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json({ error: '丹方列表读取失败，请稍后再试。' }, 500);
  }
});

router.post('/formulas/discovery/confirm', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { token, accept } = DiscoveryConfirmSchema.parse(await c.req.json());
    const result = await confirmDiscoveryCandidate(cultivator.id, token, accept);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
    }
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json({ error: '丹方确认失败，请稍后再试。' }, 500);
  }
});

export default router;
