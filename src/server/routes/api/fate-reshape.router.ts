import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  FateReshapeService,
  FateReshapeServiceError,
} from '@server/lib/services/FateReshapeService';
import { Hono } from 'hono';
import { z } from 'zod';

const ConfirmSchema = z.object({
  selectedIndices: z.array(z.number().int().nonnegative()).length(3),
});

const router = new Hono<AppEnv>();

router.get('/session', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  try {
    const [session, talismanCount] = await Promise.all([
      FateReshapeService.getSession(cultivator.id),
      FateReshapeService.getAvailableTalismanCount(cultivator.id),
    ]);

    return c.json({
      success: true,
      data: {
        session,
        talismanCount,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取命格重塑状态失败',
      },
      400,
    );
  }
});

router.post('/session', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  try {
    const session = await FateReshapeService.startSession(user.id, cultivator.id);
    const talismanCount = await FateReshapeService.getAvailableTalismanCount(
      cultivator.id,
    );

    return c.json({
      success: true,
      data: {
        session,
        talismanCount,
      },
    });
  } catch (error) {
    const status = error instanceof FateReshapeServiceError ? error.status : 400;
    return jsonWithStatus(
      c,
      {
        success: false,
        error: error instanceof Error ? error.message : '开启命格重塑失败',
      },
      status,
    );
  }
});

router.post('/reroll', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  try {
    const session = await FateReshapeService.rerollSession(cultivator.id);
    return c.json({
      success: true,
      data: { session },
    });
  } catch (error) {
    const status = error instanceof FateReshapeServiceError ? error.status : 400;
    return jsonWithStatus(
      c,
      {
        success: false,
        error: error instanceof Error ? error.message : '命格重抽失败',
      },
      status,
    );
  }
});

router.post('/confirm', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  try {
    const parsed = ConfirmSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ success: false, error: '请求参数格式错误' }, 400);
    }

    const selectedFates = await FateReshapeService.confirmSession(
      user.id,
      cultivator.id,
      parsed.data.selectedIndices,
    );

    return c.json({
      success: true,
      data: { selectedFates },
    });
  } catch (error) {
    const status = error instanceof FateReshapeServiceError ? error.status : 400;
    return jsonWithStatus(
      c,
      {
        success: false,
        error: error instanceof Error ? error.message : '确认命格重塑失败',
      },
      status,
    );
  }
});

router.post('/abandon', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  try {
    await FateReshapeService.abandonSession(cultivator.id);
    return c.json({ success: true });
  } catch (error) {
    const status = error instanceof FateReshapeServiceError ? error.status : 400;
    return jsonWithStatus(
      c,
      {
        success: false,
        error: error instanceof Error ? error.message : '放弃命格重塑失败',
      },
      status,
    );
  }
});

export default router;
