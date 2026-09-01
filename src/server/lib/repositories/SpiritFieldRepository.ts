import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { spiritFields } from '@server/lib/drizzle/schema';
import {
  createDefaultSpiritFieldPlots,
  normalizeSpiritFieldPlots,
  type SpiritFieldPlotState,
} from '@shared/engine/spirit-field';
import { eq, sql } from 'drizzle-orm';

export interface SpiritFieldRecord {
  id: string;
  cultivatorId: string;
  selfHarvestCount: number;
  totalCareCount: number;
  starterClaimed: boolean;
  plots: SpiritFieldPlotState[];
  version: number;
}

function mapRow(row: typeof spiritFields.$inferSelect): SpiritFieldRecord {
  return {
    id: row.id,
    cultivatorId: row.cultivatorId,
    selfHarvestCount: row.selfHarvestCount,
    totalCareCount: row.totalCareCount,
    starterClaimed: row.starterClaimed,
    plots: normalizeSpiritFieldPlots(row.plots),
    version: row.version,
  };
}

export async function getOrCreateSpiritField(
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<SpiritFieldRecord> {
  await q
    .insert(spiritFields)
    .values({
      cultivatorId,
      plots: createDefaultSpiritFieldPlots(),
    })
    .onConflictDoNothing({ target: spiritFields.cultivatorId });

  const [row] = await q
    .select()
    .from(spiritFields)
    .where(eq(spiritFields.cultivatorId, cultivatorId))
    .limit(1);
  if (!row) throw new Error('灵田初始化失败');
  return mapRow(row);
}

export async function updateSpiritField(
  tx: DbTransaction,
  spiritFieldId: string,
  patch: Partial<
    Pick<
      SpiritFieldRecord,
      | 'selfHarvestCount'
      | 'totalCareCount'
      | 'starterClaimed'
      | 'plots'
    >
  >,
): Promise<void> {
  await tx
    .update(spiritFields)
    .set({
      ...patch,
      version: sql`${spiritFields.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(spiritFields.id, spiritFieldId));
}
