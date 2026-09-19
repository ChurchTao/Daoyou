import {
  publishTowerWeek,
  upgradeTowerPublication,
  validatePublishedTowerWeek,
  type PublishedTowerWeek,
} from '@shared/engine/combat-v6/tower/published';
import {
  advanceTowerRewardWeek,
  TowerClaimsSchema,
  type TowerRewardState,
} from '@shared/lib/tower/reward-state';
import { getTowerSeasonMeta } from '@shared/lib/tower/season';
import type { TowerSeasonMeta } from '@shared/lib/tower/types';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, type DbExecutor, type DbTransaction } from '../drizzle/db';
import { towerRewardStates, towerWeeks } from '../drizzle/schema';

export async function readTowerPublishedWeek(
  seasonKey: string,
  executor: DbExecutor = db,
): Promise<PublishedTowerWeek | null> {
  const [row] = await executor
    .select()
    .from(towerWeeks)
    .where(eq(towerWeeks.seasonKey, seasonKey));
  if (!row) return null;
  if (
    row.schemaVersion !== row.config.schemaVersion ||
    row.config.season.seasonKey !== seasonKey
  )
    throw new Error('幻境发布配置版本无效');
  if (row.config.schemaVersion === 1) {
    if (
      row.contentVersion !== row.config.week.version ||
      row.generatorVersion !== row.config.generatorVersion
    )
      throw new Error('幻境发布版本不一致');
    const upgraded = upgradeTowerPublication(row.config);
    await executor
      .update(towerWeeks)
      .set({
        config: upgraded,
        schemaVersion: 2,
        contentVersion: upgraded.contentVersion,
      })
      .where(
        and(
          eq(towerWeeks.seasonKey, seasonKey),
          eq(towerWeeks.schemaVersion, 1),
        ),
      );
    return readTowerPublishedWeek(seasonKey, executor);
  }
  if (
    row.contentVersion !== row.config.contentVersion ||
    row.generatorVersion !== row.config.generatorVersion
  )
    throw new Error('幻境发布版本不一致');
  validatePublishedTowerWeek(row.config);
  return row.config;
}
export async function getOrPublishTowerWeek(
  season: TowerSeasonMeta,
): Promise<PublishedTowerWeek> {
  const existing = await readTowerPublishedWeek(season.seasonKey);
  if (existing) return existing;
  const since = getTowerSeasonMeta(
    new Date(Date.parse(season.seasonStartedAt) - 21 * 86400000),
  );
  const history = await db
    .select({ seasonKey: towerWeeks.seasonKey })
    .from(towerWeeks)
    .where(
      and(
        gte(towerWeeks.seasonKey, since.seasonKey),
        lt(towerWeeks.seasonKey, season.seasonKey),
      ),
    )
    .orderBy(desc(towerWeeks.seasonKey))
    .limit(3);
  const prior: PublishedTowerWeek[] = [];
  for (const row of history) {
    const week = await readTowerPublishedWeek(row.seasonKey);
    if (week) prior.push(week);
  }
  const config = publishTowerWeek(season, prior);
  await db
    .insert(towerWeeks)
    .values({
      seasonKey: season.seasonKey,
      schemaVersion: config.schemaVersion,
      contentVersion: config.contentVersion,
      generatorVersion: config.generatorVersion,
      config,
    })
    .onConflictDoNothing();
  const published = await readTowerPublishedWeek(season.seasonKey);
  if (!published) throw new Error('本周幻境尚未就绪');
  return published;
}
export async function readTowerRewardState(
  owner: string,
  executor: DbExecutor = db,
): Promise<TowerRewardState | null> {
  const [row] = await executor
    .select()
    .from(towerRewardStates)
    .where(eq(towerRewardStates.cultivatorId, owner));
  return row
    ? { seasonKey: row.seasonKey, claims: TowerClaimsSchema.parse(row.claims) }
    : null;
}
/** Caller owns the character row lock. All assets and claims use the same transaction. */
export async function writeTowerRewardState(
  owner: string,
  state: TowerRewardState,
  tx: DbTransaction,
) {
  const current = await readTowerRewardState(owner, tx);
  advanceTowerRewardWeek(current, state.seasonKey);
  const claims = TowerClaimsSchema.parse(state.claims);
  await tx
    .insert(towerRewardStates)
    .values({ cultivatorId: owner, seasonKey: state.seasonKey, claims })
    .onConflictDoUpdate({
      target: towerRewardStates.cultivatorId,
      set: { seasonKey: state.seasonKey, claims, updatedAt: new Date() },
    });
}
