import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { towerEnemySets } from '@server/lib/drizzle/schema';
import type {
  TowerPreparedEnemy,
  TowerPreparedEnemySetStatus,
} from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';
import { and, desc, eq } from 'drizzle-orm';

export type TowerEnemySetRecord = typeof towerEnemySets.$inferSelect;

export async function findTowerEnemySet(args: {
  seasonKey: string;
  realm: RealmType;
  status?: TowerPreparedEnemySetStatus;
  q?: DbExecutor;
}): Promise<TowerEnemySetRecord | undefined> {
  const q = args.q ?? getExecutor();
  const filters = [
    eq(towerEnemySets.seasonKey, args.seasonKey),
    eq(towerEnemySets.realm, args.realm),
  ];
  if (args.status) {
    filters.push(eq(towerEnemySets.status, args.status));
  }

  const [row] = await q
    .select()
    .from(towerEnemySets)
    .where(and(...filters))
    .limit(1);

  return row;
}

export async function findLatestReadyTowerEnemySet(args: {
  realm: RealmType;
  q?: DbExecutor;
}): Promise<TowerEnemySetRecord | undefined> {
  const q = args.q ?? getExecutor();
  const [row] = await q
    .select()
    .from(towerEnemySets)
    .where(
      and(
        eq(towerEnemySets.realm, args.realm),
        eq(towerEnemySets.status, 'ready'),
      ),
    )
    .orderBy(desc(towerEnemySets.generatedAt))
    .limit(1);

  return row;
}

export async function listTowerEnemySetsBySeason(args: {
  seasonKey: string;
  q?: DbExecutor;
}): Promise<TowerEnemySetRecord[]> {
  const q = args.q ?? getExecutor();
  return q
    .select()
    .from(towerEnemySets)
    .where(eq(towerEnemySets.seasonKey, args.seasonKey));
}

export async function upsertReadyTowerEnemySet(args: {
  seasonKey: string;
  realm: RealmType;
  enemies: TowerPreparedEnemy[];
  generatedAt: Date;
  schemaVersion: number;
  q?: DbExecutor;
}): Promise<void> {
  const q = args.q ?? getExecutor();
  await q
    .insert(towerEnemySets)
    .values({
      seasonKey: args.seasonKey,
      realm: args.realm,
      status: 'ready',
      schemaVersion: args.schemaVersion,
      enemies: args.enemies,
      generatedAt: args.generatedAt,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [towerEnemySets.seasonKey, towerEnemySets.realm],
      set: {
        status: 'ready',
        schemaVersion: args.schemaVersion,
        enemies: args.enemies,
        generatedAt: args.generatedAt,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
}

export async function upsertFailedTowerEnemySet(args: {
  seasonKey: string;
  realm: RealmType;
  errorMessage: string;
  q?: DbExecutor;
}): Promise<void> {
  const q = args.q ?? getExecutor();
  await q
    .insert(towerEnemySets)
    .values({
      seasonKey: args.seasonKey,
      realm: args.realm,
      status: 'failed',
      schemaVersion: 1,
      enemies: [],
      errorMessage: args.errorMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [towerEnemySets.seasonKey, towerEnemySets.realm],
      set: {
        status: 'failed',
        enemies: [],
        errorMessage: args.errorMessage,
        updatedAt: new Date(),
      },
    });
}
