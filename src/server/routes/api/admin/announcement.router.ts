import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getAuthPageAnnouncement,
  upsertAppSetting,
} from '@server/lib/repositories/appSettingsRepository';
import { APP_SETTING_KEYS } from '@shared/lib/constants/appSettings';
import { Hono } from 'hono';
import { z } from 'zod';

const PatchBodySchema = z.object({
  announcement: z.string(),
});

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const announcement = await getAuthPageAnnouncement();

  return c.json({
    announcement: announcement ?? '',
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
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const announcement = parsed.data.announcement.trim();

  await upsertAppSetting({
    key: APP_SETTING_KEYS.authPageAnnouncement,
    value: announcement,
    updatedBy: user.id,
  });

  return c.json({
    ok: true,
    announcement,
  });
});

export default router;
