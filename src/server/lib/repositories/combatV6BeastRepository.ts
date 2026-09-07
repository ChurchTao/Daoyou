import type { DbExecutor } from '@server/lib/drizzle/db';
import {
  combatV6BeastLineups,
  combatV6Beasts,
  cultivators,
} from '@server/lib/drizzle/schema';
import type { WildSettlement } from '@shared/contracts/combatV6Wild';
import {
  BeastLineupSchema,
  type BeastRoster,
  BeastSchema,
  loseBeastLifespan,
} from '@shared/engine/combat-v6/beasts';
import {
  BEAST_CAPACITY,
  gainBeastExp,
} from '@shared/engine/combat-v6/beasts/progression';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, inArray } from 'drizzle-orm';

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
    .select({ individual: combatV6Beasts.individual })
    .from(combatV6Beasts)
    .where(eq(combatV6Beasts.cultivatorId, cultivatorId))
    .orderBy(combatV6Beasts.createdAt, combatV6Beasts.id);
  const [state] = await tx
    .select()
    .from(combatV6BeastLineups)
    .where(eq(combatV6BeastLineups.cultivatorId, cultivatorId));
  const { ownerLevel, spiritStones } = await readBeastOwner(cultivatorId, tx);
  return {
    ownerLevel,
    spiritStones,
    beasts: rows.map((row) => BeastSchema.parse(row.individual)),
    lineup: BeastLineupSchema.parse(
      state?.lineup ?? { carriedBeastIds: [], revision: 0 },
    ),
    starterClaimed: !!state?.starterBeastId,
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
    await tx.insert(combatV6Beasts).values({
      id: beast.id,
      cultivatorId: summary.cultivatorId,
      individual: beast,
    });
  }
  if (summary.beastExperience) {
    const reward = summary.beastExperience;
    const beast = roster.beasts.find((b) => b.id === reward.beastId);
    if (!beast) throw new Error('经验接收灵兽不存在');
    const next = gainBeastExp(beast, reward.amount, roster.ownerLevel);
    if (next !== beast)
      await tx
        .update(combatV6Beasts)
        .set({ individual: next })
        .where(eq(combatV6Beasts.id, beast.id));
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
    .from(combatV6Beasts)
    .where(
      and(
        eq(combatV6Beasts.cultivatorId, cultivatorId),
        inArray(combatV6Beasts.id, [...new Set(ids)]),
      ),
    );
  for (const row of rows)
    await tx
      .update(combatV6Beasts)
      .set({ individual: loseBeastLifespan(BeastSchema.parse(row.individual)) })
      .where(eq(combatV6Beasts.id, row.id));
}
