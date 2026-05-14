import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  ManualDrawService,
  ManualDrawServiceError,
} from '@server/lib/services/ManualDrawService';
import { MANUAL_DRAW_KIND_VALUES } from '@shared/types/manualDraw';
import { Hono } from 'hono';
import { z } from 'zod';

const DrawSchema = z.object({
  kind: z.enum(MANUAL_DRAW_KIND_VALUES),
  count: z.union([z.literal(1), z.literal(5)]),
});

const router = new Hono<AppEnv>();

router.post('/', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  try {
    const parsed = DrawSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ success: false, error: '请求参数格式错误' }, 400);
    }

    const result = await ManualDrawService.draw(
      user.id,
      cultivator.id,
      parsed.data.kind,
      parsed.data.count,
    );

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const status = error instanceof ManualDrawServiceError ? error.status : 400;
    return jsonWithStatus(
      c,
      {
        success: false,
        error: error instanceof Error ? error.message : '秘籍抽取失败',
      },
      status,
    );
  }
});

router.get('/status', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  try {
    const status = await ManualDrawService.getStatus(cultivator.id);
    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    const status = error instanceof ManualDrawServiceError ? error.status : 400;
    return jsonWithStatus(
      c,
      {
        success: false,
        error: error instanceof Error ? error.message : '获取抽取状态失败',
      },
      status,
    );
  }
});

export default router;
