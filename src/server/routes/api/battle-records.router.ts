import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();
// Direct record and share URLs are retired; historical rows stay intact.
router.all('*', (c) =>
  c.json(
    {
      success: false,
      error: '旧版战绩已停止查看，请前往新版战绩。',
      code: 'LEGACY_BATTLE_HISTORY_RETIRED',
    },
    410,
  ),
);
export default router;
