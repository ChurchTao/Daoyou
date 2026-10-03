import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import { cultivators, spiritualRoots } from '@server/lib/drizzle/schema.js';
import type {
  CultivationProgress,
  Cultivator,
} from '@daoyou/shared/types/cultivator';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import type { RealmStage, RealmType } from '@daoyou/shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { mapSpiritualRoots } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';

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

export async function readMarrowWashFacts(
  userId: string,
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{
  realm: RealmType;
  condition?: CultivatorCondition;
  spiritualRoots: Cultivator['spiritual_roots'];
} | null> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({
      realm: cultivators.realm,
      condition: cultivators.condition,
    })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, cultivatorId),
        eq(cultivators.userId, userId),
        eq(cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;
  const roots = await q
    .select()
    .from(spiritualRoots)
    .where(eq(spiritualRoots.cultivatorId, cultivatorId));
  return {
    realm: row.realm as RealmType,
    condition:
      (row.condition as CultivatorCondition | null | undefined) ?? undefined,
    spiritualRoots: mapSpiritualRoots(roots),
  };
}
