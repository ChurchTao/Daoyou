import {
  getValidatedJson,
  getValidatedQuery,
  requireAdmin,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  listTowerPublishedWeeks,
  parseTowerWeekRecord,
  readTowerWeekRecord,
  regenerateTowerWeek,
  towerWeekFingerprint,
} from '@server/lib/repositories/towerRepository';
import type { AdminTowerView } from '@shared/contracts/adminTower';
import {
  publishedTowerEncounter,
  publishedTowerPreviews,
} from '@shared/engine/combat-v6/tower/published';
import {
  TOWER_ELIGIBLE_REALMS,
  TOWER_MAX_FLOOR,
  TOWER_MIN_REALM,
} from '@shared/lib/tower/helpers';
import {
  getNextTowerSeasonMeta,
  getTowerSeasonMeta,
} from '@shared/lib/tower/season';
import { REALM_VALUES } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const SeasonKeySchema = z
  .string()
  .regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])@Asia\/Shanghai$/);
const QuerySchema = z.object({
  seasonKey: SeasonKeySchema.optional(),
  realm: z
    .enum(REALM_VALUES)
    .refine((realm) => TOWER_ELIGIBLE_REALMS.includes(realm), '蜃楼境界未开放')
    .default(TOWER_MIN_REALM),
  floor: z.coerce.number().int().min(1).max(TOWER_MAX_FLOOR).default(1),
});
const RegenerateSchema = z.strictObject({
  seasonKey: SeasonKeySchema,
  expectedFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
const router = new Hono<AppEnv>();
router.use('*', requireAdmin());

router.get('/', validateQuery(QuerySchema), async (c) => {
  const query = getValidatedQuery<z.infer<typeof QuerySchema>>(c);
  const currentSeason = getTowerSeasonMeta();
  const nextSeason = getNextTowerSeasonMeta(
    new Date(currentSeason.seasonStartedAt),
  );
  const seasonKey = query.seasonKey ?? currentSeason.seasonKey;
  const [weeks, row] = await Promise.all([
    listTowerPublishedWeeks(),
    readTowerWeekRecord(seasonKey),
  ]);
  // Read and validate this exact snapshot, keeping its fingerprint and display consistent.
  const pack = parseTowerWeekRecord(row);
  const summarize = (item: (typeof weeks)[number]) => ({
    seasonKey: item.seasonKey,
    schemaVersion: item.schemaVersion,
    contentVersion: item.contentVersion,
    generatorVersion: item.generatorVersion,
    publishedAt: item.createdAt.toISOString(),
  });
  const data: AdminTowerView = {
    currentSeason,
    nextSeason,
    seasonKey,
    realm: query.realm,
    floor: query.floor,
    weeks: weeks.map(summarize),
    fingerprint: towerWeekFingerprint(row),
    published: row ? summarize(row) : null,
    configuration: pack
      ? {
          season: pack.season,
          previews: publishedTowerPreviews(pack),
          encounter: publishedTowerEncounter(pack, query.realm, query.floor),
        }
      : null,
  };
  c.header('Cache-Control', 'no-store');
  return c.json({ success: true, data });
});

router.post('/regenerate', validateJson(RegenerateSchema), async (c) => {
  const input = getValidatedJson<z.infer<typeof RegenerateSchema>>(c);
  const current = getTowerSeasonMeta();
  const next = getNextTowerSeasonMeta(new Date(current.seasonStartedAt));
  const season = [current, next].find(
    (item) => item.seasonKey === input.seasonKey,
  );
  if (!season) return c.json({ error: '仅可重新生成本周或下周配置' }, 400);
  const replaced = await regenerateTowerWeek(season, input.expectedFingerprint);
  if (!replaced)
    return c.json({ error: '周配置已变化，请刷新后重新生成' }, 409);
  return c.json({ success: true });
});
export default router;
