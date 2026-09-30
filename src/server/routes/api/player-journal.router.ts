import {
  getValidatedQuery,
  requireActiveCultivatorRef,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { listPlayerJournal } from '@server/lib/repositories/playerJournalRepository';
import { PlayerJournalQuerySchema } from '@shared/contracts/playerJournal';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.onError((error, c) => {
  if (error instanceof z.ZodError)
    return c.json({ error: '日志查询参数无效' }, 400);
  console.error('修仙日志查询失败:', error);
  return c.json({ error: '修仙日志暂时无法读取' }, 500);
});
router.get(
  '/',
  requireActiveCultivatorRef(),
  validateQuery(PlayerJournalQuerySchema),
  async (c) => {
    const { cultivatorId } = c.get('activeCultivatorRef')!;
    const query =
      getValidatedQuery<z.infer<typeof PlayerJournalQuerySchema>>(c);
    c.header('Cache-Control', 'no-store');
    return c.json({
      success: true,
      data: await listPlayerJournal(cultivatorId, query),
    });
  },
);
export default router;
