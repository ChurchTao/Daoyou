import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import type { BodyCultivationBreakthroughReadinessData } from '@shared/contracts/bodyCultivation';
import { previewBodyCultivationRealmBreakthrough } from '@shared/lib/bodyCultivation/breakthrough';
import type { Cultivator } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';

export type BodyCultivationFacts = Pick<
  Cultivator,
  'id' | 'realm' | 'condition'
>;

export async function loadPlayerBodyCultivationFacts(
  userId: string,
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<BodyCultivationFacts | null> {
  const [row] = await q
    .select({
      id: schema.cultivators.id,
      realm: schema.cultivators.realm,
      condition: schema.cultivators.condition,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return row
    ? {
        id: row.id,
        realm: row.realm as Cultivator['realm'],
        condition:
          (row.condition as Cultivator['condition'] | null) ?? undefined,
      }
    : null;
}

export function getBodyCultivationBreakthroughPreviewData(
  cultivator: BodyCultivationFacts,
): BodyCultivationBreakthroughReadinessData {
  const preview = previewBodyCultivationRealmBreakthrough(
    cultivator.condition,
    { cultivatorRealm: cultivator.realm },
  );

  return {
    currentRealm: preview.currentRealm,
    nextRealm: preview.nextRealm,
    canAdvance: preview.canAdvance,
    totalLevel: preview.totalLevel,
    requiredTotalLevel: preview.requiredTotalLevel,
    requiredCultivationRealm: preview.requiredCultivationRealm,
    requirements: preview.requirements,
  };
}
