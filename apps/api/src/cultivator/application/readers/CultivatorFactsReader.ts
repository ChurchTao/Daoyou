import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import type {
  CultivationProgress,
} from '@daoyou/game-domain/character';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { eq, inArray } from 'drizzle-orm';

export async function readCultivatorTitles(ids: string[], executor?: DbExecutor) {
  if (!ids.length) return new Map<string, string | null>();
  const rows = await (executor ?? getExecutor())
    .select({ id: cultivators.id, title: cultivators.title })
    .from(cultivators)
    .where(inArray(cultivators.id, ids));
  return new Map(rows.map((row) => [row.id, row.title]));
}

async function requireFacts<T>(
  cultivatorId: string,
  load: (q: DbExecutor | DbTransaction) => Promise<T | undefined>,
  executor?: DbExecutor | DbTransaction,
): Promise<T> {
  const facts = await load(executor ?? getExecutor());
  if (!facts) throw new Error(`角色不存在: ${cultivatorId}`);
  return facts;
}

export function readCultivatorName(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{ name: string }> {
  return requireFacts(
    cultivatorId,
    (q) =>
      q.query.cultivators.findFirst({
        columns: { name: true },
        where: eq(cultivators.id, cultivatorId),
      }),
    executor,
  );
}

export function readCultivatorRealm(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{ realm: RealmType; realmStage: RealmStage }> {
  return requireFacts(
    cultivatorId,
    async (q) => {
      const row = await q.query.cultivators.findFirst({
        columns: { realm: true, realm_stage: true },
        where: eq(cultivators.id, cultivatorId),
      });
      return row
        ? {
            realm: row.realm as RealmType,
            realmStage: row.realm_stage as RealmStage,
          }
        : undefined;
    },
    executor,
  );
}

export function readCultivatorPublicIdentity(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{ name: string; realm: RealmType; realmStage: RealmStage }> {
  return requireFacts(
    cultivatorId,
    async (q) => {
      const row = await q.query.cultivators.findFirst({
        columns: { name: true, realm: true, realm_stage: true },
        where: eq(cultivators.id, cultivatorId),
      });
      return row
        ? {
            name: row.name,
            realm: row.realm as RealmType,
            realmStage: row.realm_stage as RealmStage,
          }
        : undefined;
    },
    executor,
  );
}

export function readCultivatorQi(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{ qi: number; qiLastRefreshedAt: Date }> {
  return requireFacts(
    cultivatorId,
    (q) =>
      q.query.cultivators.findFirst({
        columns: { qi: true, qiLastRefreshedAt: true },
        where: eq(cultivators.id, cultivatorId),
      }),
    executor,
  );
}

export function readCraftReadinessFacts(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{
  spiritStones: number;
  cultivationProgress: CultivationProgress | null;
}> {
  return requireFacts(
    cultivatorId,
    async (q) => {
      const row = await q.query.cultivators.findFirst({
        columns: { spirit_stones: true, cultivation_progress: true },
        where: eq(cultivators.id, cultivatorId),
      });
      return row
        ? {
            spiritStones: row.spirit_stones,
            cultivationProgress:
              (row.cultivation_progress as CultivationProgress | null) ?? null,
          }
        : undefined;
    },
    executor,
  );
}

export function readCultivatorReputation(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{ reputation: number }> {
  return requireFacts(
    cultivatorId,
    (q) =>
      q.query.cultivators.findFirst({
        columns: { reputation: true },
        where: eq(cultivators.id, cultivatorId),
      }),
    executor,
  );
}
