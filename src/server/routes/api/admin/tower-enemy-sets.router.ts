import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { towerEnemySetService } from '@server/lib/tower/enemySets';
import {
  getNextTowerSeasonMeta,
  getTowerSeasonMeta,
  TOWER_ELIGIBLE_REALMS,
  type TowerSeasonMeta,
} from '@shared/lib/tower';
import { Hono } from 'hono';
import { z } from 'zod';

const SeasonKeySchema = z
  .string()
  .regex(/^\d{4}-W\d{2}@Asia\/Shanghai$/, 'invalid seasonKey');

const GenerateBodySchema = z.object({
  seasonKey: SeasonKeySchema.optional(),
  realm: z.enum(TOWER_ELIGIBLE_REALMS).optional(),
  force: z.boolean().optional().default(false),
});

function buildSeasonFromKey(seasonKey: string): TowerSeasonMeta {
  return {
    seasonKey,
    seasonStartedAt: '',
    seasonEndsAt: '',
    nextResetAt: '',
  };
}

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const currentSeason = getTowerSeasonMeta();
  const nextSeason = getNextTowerSeasonMeta();
  const rawSeasonKey = c.req.query('seasonKey')?.trim() || currentSeason.seasonKey;
  const parsed = SeasonKeySchema.safeParse(rawSeasonKey);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const snapshot = await towerEnemySetService.getAdminSnapshot(parsed.data);

  return c.json({
    success: true,
    data: {
      currentSeason,
      nextSeason,
      snapshot,
    },
  });
});

router.post('/generate', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = GenerateBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const seasonKey = parsed.data.seasonKey ?? getTowerSeasonMeta().seasonKey;
  const season = buildSeasonFromKey(seasonKey);
  const result = parsed.data.realm
    ? await towerEnemySetService.ensureTowerEnemySet(
        season,
        parsed.data.realm,
        { force: parsed.data.force },
      )
    : await towerEnemySetService.ensureTowerEnemySetsForSeason(season, {
        force: parsed.data.force,
      });
  const snapshot = await towerEnemySetService.getAdminSnapshot(seasonKey);

  return c.json({
    success: true,
    data: {
      result,
      snapshot,
    },
  });
});

export default router;
