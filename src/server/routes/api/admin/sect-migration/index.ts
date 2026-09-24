import {
  getValidatedJson,
  requireAdmin,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { SectMigrationBatchSchema } from '@shared/contracts/sectMigration';
import { Hono } from 'hono';
import type { z } from 'zod';
import {
  executeSectMigration,
  exportSectMigrationAudit,
  sectMigrationReport,
} from './service';

const router = new Hono<AppEnv>();
router.use('*', requireAdmin());
router.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
router.get('/', async (c) => c.json(await sectMigrationReport()));
router.get('/audit', async (c) => {
  c.header(
    'Content-Disposition',
    'attachment; filename="sect-migration-audit.json"',
  );
  return c.json(await exportSectMigrationAudit());
});
router.post('/batch', validateJson(SectMigrationBatchSchema), async (c) => {
  const input = getValidatedJson<z.infer<typeof SectMigrationBatchSchema>>(c);
  try {
    return c.json({
      results: await executeSectMigration(
        input.membershipIds,
        c.get('user')!.id,
      ),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      409,
    );
  }
});
export default router;
