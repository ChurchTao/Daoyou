import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import {
  BEAST_PICKER_PAGE_SIZE,
  type BeastPickerLocation,
  type BeastPickerPage,
} from '@daoyou/contracts/beasts';
import {
  BeastLineupSchema,
  type BeastLineup,
  type BeastRoster,
  type SummonedBeast,
} from '@daoyou/game-domain/beasts';
import { getRealmStageLevel as combatCharacterLevel } from '@daoyou/game-domain/progression';
import type { WildSettlement } from '@daoyou/game-domain/wild';
import {
  carriedBeastIds,
  gainBeastExp,
  loseBeastLifespan,
  splitCapturedBeasts,
} from '@daoyou/game-rules/beasts/growth';
import { BeastSchema } from '@daoyou/game-rules/beasts/validation';
import type { DbExecutor } from '@server/lib/drizzle/db.js';
import {
  cultivatorBeastLineups,
  cultivatorBeasts,
  cultivators,
} from '@server/lib/drizzle/schema.js';
import { and, count, eq, inArray, notInArray, type SQL } from 'drizzle-orm';

/** Identity and ownership have a single authority in relational columns. */
export function beastIndividualData(beast: SummonedBeast) {
  const { id: _id, ownerCultivatorId: _owner, ...individual } = beast;
  void _id;
  void _owner;
  return individual;
}

export function beastFromRow(row: typeof cultivatorBeasts.$inferSelect) {
  return BeastSchema.parse({
    ...row.individual,
    id: row.id,
    ownerCultivatorId: row.cultivatorId,
  });
}

export async function readBeastOwner(cultivatorId: string, tx: DbExecutor) {
  const [row] = await tx
    .select({
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
      userId: cultivators.userId,
      spiritStones: cultivators.spirit_stones,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId));
  if (!row) throw new Error('角色不存在');
  return {
    ownerLevel: combatCharacterLevel(
      row.realm as RealmType,
      row.realmStage as RealmStage,
    ),
    userId: row.userId,
    spiritStones: row.spiritStones ?? 0,
  };
}

export async function readBeastRoster(
  cultivatorId: string,
  tx: DbExecutor,
): Promise<
  BeastRoster & {
    starterClaimed: boolean;
    ownerLevel: number;
    spiritStones: number;
  }
> {
  const rows = await tx
    .select()
    .from(cultivatorBeasts)
    .where(eq(cultivatorBeasts.cultivatorId, cultivatorId))
    .orderBy(cultivatorBeasts.createdAt, cultivatorBeasts.id);
  const [state] = await tx
    .select()
    .from(cultivatorBeastLineups)
    .where(eq(cultivatorBeastLineups.cultivatorId, cultivatorId));
  const { ownerLevel, spiritStones } = await readBeastOwner(cultivatorId, tx);
  return {
    ownerLevel,
    spiritStones,
    beasts: rows.map(beastFromRow),
    lineup: BeastLineupSchema.parse(
      state?.lineup ?? { carriedBeastIds: [], revision: 0 },
    ),
    starterClaimed: !!state?.starterClaimedAt,
  };
}

async function countBeasts(where: SQL | undefined, tx: DbExecutor) {
  const [row] = await tx
    .select({ total: count() })
    .from(cultivatorBeasts)
    .where(where);
  return Number(row?.total ?? 0);
}

export async function readBeastPickerPage(
  cultivatorId: string,
  query: { page: number; location: BeastPickerLocation; beast?: string },
  tx: DbExecutor,
): Promise<BeastPickerPage> {
  const [state] = await tx
    .select()
    .from(cultivatorBeastLineups)
    .where(eq(cultivatorBeastLineups.cultivatorId, cultivatorId));
  const lineup = BeastLineupSchema.parse(
    state?.lineup ?? { carriedBeastIds: [], revision: 0 },
  );
  const carried = lineup.carriedBeastIds;
  const owned = eq(cultivatorBeasts.cultivatorId, cultivatorId);
  const bagWhere = carried.length
    ? and(owned, inArray(cultivatorBeasts.id, carried))
    : undefined;
  const warehouseWhere = carried.length
    ? and(owned, notInArray(cultivatorBeasts.id, carried))
    : owned;
  const where =
    query.location === 'bag'
      ? bagWhere
      : query.location === 'warehouse'
        ? warehouseWhere
        : owned;
  const [bagCount, warehouseCount] = await Promise.all([
    bagWhere ? countBeasts(bagWhere, tx) : Promise.resolve(0),
    countBeasts(warehouseWhere, tx),
  ]);
  const idRows = where
    ? await tx
        .select({ id: cultivatorBeasts.id })
        .from(cultivatorBeasts)
        .where(where)
        .orderBy(cultivatorBeasts.createdAt, cultivatorBeasts.id)
    : [];
  const total = idRows.length;
  const pageCount = Math.max(1, Math.ceil(total / BEAST_PICKER_PAGE_SIZE));
  let current = Math.min(query.page, pageCount);
  if (query.beast) {
    const index = idRows.findIndex((row) => row.id === query.beast);
    if (index >= 0) current = Math.floor(index / BEAST_PICKER_PAGE_SIZE) + 1;
  }
  const slice = idRows
    .slice(
      (current - 1) * BEAST_PICKER_PAGE_SIZE,
      current * BEAST_PICKER_PAGE_SIZE,
    )
    .map((row) => row.id);
  const rows = slice.length
    ? await tx
        .select()
        .from(cultivatorBeasts)
        .where(inArray(cultivatorBeasts.id, slice))
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const { ownerLevel, spiritStones } = await readBeastOwner(cultivatorId, tx);
  return {
    beasts: slice.flatMap((id) => {
      const row = byId.get(id);
      return row ? [beastFromRow(row)] : [];
    }),
    page: current,
    pageSize: BEAST_PICKER_PAGE_SIZE,
    total,
    ownerLevel,
    spiritStones,
    lineup,
    bagCount,
    warehouseCount,
  };
}

export async function countBagBeasts(cultivatorId: string, tx: DbExecutor) {
  const roster = await readBeastRoster(cultivatorId, tx);
  return carriedBeastIds(roster.beasts, roster.lineup).length;
}

export async function saveBeastLineup(
  cultivatorId: string,
  lineup: BeastLineup,
  tx: DbExecutor,
) {
  await tx
    .insert(cultivatorBeastLineups)
    .values({ cultivatorId, lineup })
    .onConflictDoUpdate({
      target: cultivatorBeastLineups.cultivatorId,
      set: { lineup },
    });
}

/** Caller claims the battle settlement and holds the character lock in this transaction. */
export async function settleBeastProgress(
  summary: WildSettlement,
  tx: DbExecutor,
) {
  const roster = await readBeastRoster(summary.cultivatorId, tx);
  const captured = (summary.capturedBeasts ?? []).map((individual) => {
    const beast = BeastSchema.parse(individual);
    if (beast.ownerCultivatorId !== summary.cultivatorId)
      throw new Error('捕获灵兽归属不符');
    return beast;
  });
  const carried = carriedBeastIds(roster.beasts, roster.lineup);
  const { bagIds } = splitCapturedBeasts(
    carried.length,
    captured.map((beast) => beast.id),
  );
  for (const beast of captured)
    await tx.insert(cultivatorBeasts).values({
      id: beast.id,
      cultivatorId: summary.cultivatorId,
      individual: beastIndividualData(beast),
    });
  if (bagIds.length)
    await saveBeastLineup(
      summary.cultivatorId,
      {
        carriedBeastIds: [...carried, ...bagIds],
        leadBeastId: roster.lineup.leadBeastId,
        revision: roster.lineup.revision + 1,
      },
      tx,
    );
  if (summary.beastExperience) {
    const reward = summary.beastExperience;
    const beast = roster.beasts.find((b) => b.id === reward.beastId);
    if (!beast) throw new Error('经验接收灵兽不存在');
    const next = gainBeastExp(beast, reward.amount, roster.ownerLevel);
    if (next !== beast)
      await tx
        .update(cultivatorBeasts)
        .set({ individual: beastIndividualData(next) })
        .where(eq(cultivatorBeasts.id, beast.id));
  }
}

/** Caller holds the character lock and claims the battle settlement in the same transaction. */
export async function settleBeastDeaths(
  cultivatorId: string,
  ids: string[],
  tx: DbExecutor,
) {
  if (!ids.length) return;
  const rows = await tx
    .select()
    .from(cultivatorBeasts)
    .where(
      and(
        eq(cultivatorBeasts.cultivatorId, cultivatorId),
        inArray(cultivatorBeasts.id, [...new Set(ids)]),
      ),
    );
  for (const row of rows)
    await tx
      .update(cultivatorBeasts)
      .set({
        individual: beastIndividualData(loseBeastLifespan(beastFromRow(row))),
      })
      .where(eq(cultivatorBeasts.id, row.id));
}
