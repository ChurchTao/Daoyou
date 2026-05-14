import {
  getAppSetting,
  getResolvedCommunityQrcodeSourceUrl,
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
  sourceUrl: z
    .string()
    .trim()
    .min(1, 'URL 不能为空')
    .max(2048)
    .refine((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, '请输入有效的 https 图片地址'),
});

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const resolved = await getResolvedCommunityQrcodeSourceUrl();
  const stored = await getAppSetting(
    APP_SETTING_KEYS.communityQrcodeSourceUrl,
  );

  return c.json({
    sourceUrl: resolved,
    storedInDb: Boolean(stored),
    storedUrl: stored,
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
    key: APP_SETTING_KEYS.communityQrcodeSourceUrl,
    value: parsed.data.sourceUrl,
    updatedBy: user.id,
  });

  const resolved = await getResolvedCommunityQrcodeSourceUrl();
  return c.json({ ok: true, sourceUrl: resolved });
});

export default router;
