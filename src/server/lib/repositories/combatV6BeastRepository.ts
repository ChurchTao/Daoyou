import type { DbExecutor } from '@server/lib/drizzle/db';
import {
  cultivatorBeastLineups,
  cultivatorBeasts,
  cultivators,
} from '@server/lib/drizzle/schema';
import type { WildSettlement } from '@shared/contracts/combatV6Wild';
import {
  BeastLineupSchema,
  type BeastRoster,
  BeastSchema,
  type SummonedBeast,
  loseBeastLifespan,
} from '@shared/engine/combat-v6/beasts';
import {
  BEAST_CAPACITY,
  gainBeastExp,
} from '@shared/engine/combat-v6/beasts/progression';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, inArray } from 'drizzle-orm';

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

/** Caller claims the battle settlement and holds the character lock in this transaction. */
export async function settleBeastProgress(
  summary: WildSettlement,
  tx: DbExecutor,
) {
  const roster = await readBeastRoster(summary.cultivatorId, tx);
  const captured = summary.capturedBeasts ?? [];
  if (roster.beasts.length + captured.length > BEAST_CAPACITY)
    throw new Error('灵兽持有数量超限');
  for (const individual of captured) {
    const beast = BeastSchema.parse(individual);
    if (beast.ownerCultivatorId !== summary.cultivatorId)
      throw new Error('捕获灵兽归属不符');
    await tx.insert(cultivatorBeasts).values({
      id: beast.id,
      cultivatorId: summary.cultivatorId,
      individual: beastIndividualData(beast),
    });
  }
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
