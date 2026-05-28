import {
  getAppSetting,
  getResolvedCommunityQqGroupNumber,
  upsertAppSetting,
} from '@server/lib/repositories/appSettingsRepository';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  APP_SETTING_KEYS,
} from '@shared/lib/constants/appSettings';
import { Hono } from 'hono';
import { z } from 'zod';

const PatchBodySchema = z.object({
  groupNumber: z
    .string()
    .trim()
    .regex(/^\d{5,12}$/, '请输入 5 到 12 位数字 QQ 群号'),
});

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const resolved = await getResolvedCommunityQqGroupNumber();
  const stored = await getAppSetting(APP_SETTING_KEYS.communityQqGroupNumber);

  return c.json({
    groupNumber: resolved,
    customized: Boolean(stored),
    storedGroupNumber: stored,
  });
});

router.patch('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  await upsertAppSetting({
    key: APP_SETTING_KEYS.communityQqGroupNumber,
    value: parsed.data.groupNumber,
    updatedBy: user.id,
  });

  const resolved = await getResolvedCommunityQqGroupNumber();
  return c.json({ ok: true, groupNumber: resolved });
});

export default router;
