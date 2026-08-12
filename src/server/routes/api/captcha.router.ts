import {
  createAltchaChallenge,
  isAltchaAction,
  isAltchaServerEnabled,
} from '@server/lib/auth/altcha';
import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/challenge', async (c) => {
  const action = c.req.query('action') ?? '';
  if (!isAltchaAction(action)) {
    return c.json({ success: false, error: '无效的人机验证场景' }, 400);
  }

  if (!isAltchaServerEnabled()) {
    return c.json({ success: false, error: '人机验证服务未配置' }, 503);
  }

  try {
    const challenge = await createAltchaChallenge(action);
    c.header('Cache-Control', 'no-store');
    return c.json(challenge);
  } catch (error) {
    console.error('[altcha] challenge creation failed', error);
    return c.json({ success: false, error: '人机验证服务暂不可用' }, 503);
  }
});

export default router;
