import { db, type DbExecutor } from '@server/lib/drizzle/db';
import {
  combatV6BeastLineups,
  combatV6Beasts,
} from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { readBeastRoster } from '@server/lib/repositories/combatV6BeastRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  BEAST_SPECIES,
  BeastLineupSchema,
  generateStarterBeast,
  type BeastLineup,
} from '@shared/engine/combat-v6/beasts';
import { eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { arenaOccupancyKey } from './CombatV6ArenaStore';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { CombatV6WildStore } from './CombatV6WildStore';

export class BeastError extends Error {
  readonly status = 409;
}

async function mutate<T>(
  cultivatorId: string,
  action: (tx: DbExecutor) => Promise<T>,
) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(cultivatorId),
      context: 'combat-v6-beast',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, cultivatorId);
        if (
          (await new CombatV6WildStore().lock(cultivatorId)) ||
          (await redis.get(arenaOccupancyKey(cultivatorId))) ||
          (await new CombatV6RuntimeStore().currentId(cultivatorId))
        )
          throw new BeastError('请先结束战斗与结算，再调整灵兽');
        const result = await action(tx);
        lease.assertHeld();
        return result;
      }),
  );
}

export async function claimStarterBeast(
  cultivatorId: string,
  speciesId: string,
) {
  if (!BEAST_SPECIES.some((s) => s.id === speciesId))
    throw new BeastError('未知灵兽');
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    if (roster.starterClaimed) return roster;
    const beast = generateStarterBeast(
      randomUUID(),
      cultivatorId,
      speciesId,
      randomInt(0, 0x7fffffff),
    );
    await tx
      .insert(combatV6Beasts)
      .values({ id: beast.id, cultivatorId, individual: beast });
    const lineup = {
      carriedBeastIds: [...roster.lineup.carriedBeastIds, beast.id].slice(0, 6),
      leadBeastId: roster.lineup.leadBeastId ?? beast.id,
      revision: roster.lineup.revision + 1,
    };
    await tx
      .insert(combatV6BeastLineups)
      .values({ cultivatorId, lineup, starterBeastId: beast.id })
      .onConflictDoUpdate({
        target: combatV6BeastLineups.cultivatorId,
        set: { lineup, starterBeastId: beast.id },
      });
    return readBeastRoster(cultivatorId, tx);
  });
}

export async function updateBeastLineup(
  cultivatorId: string,
  input: BeastLineup,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const lineup = BeastLineupSchema.parse(input);
    if (lineup.revision !== roster.lineup.revision)
      throw new BeastError('编组已变化，请刷新后重试');
    if (
      lineup.carriedBeastIds.some(
        (id) => !roster.beasts.some((b) => b.id === id),
      )
    )
      throw new BeastError('只能携带自己的灵兽');
    if (
      lineup.leadBeastId &&
      !roster.beasts.some(
        (b) => b.id === lineup.leadBeastId && b.currentLifespan >= 50,
      )
    )
      throw new BeastError('寿命不足，不能设为首发');
    const next = { ...lineup, revision: lineup.revision + 1 };
    await tx
      .insert(combatV6BeastLineups)
      .values({ cultivatorId, lineup: next })
      .onConflictDoUpdate({
        target: combatV6BeastLineups.cultivatorId,
        set: { lineup: next },
      });
    return readBeastRoster(cultivatorId, tx);
  });
}

export async function restBeast(
  cultivatorId: string,
  id: string,
  revision: number,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const beast = roster.beasts.find((b) => b.id === id);
    if (!beast || beast.revision !== revision)
      throw new BeastError('灵兽状态已变化，请刷新后重试');
    if (beast.currentLifespan < beast.maxLifespan)
      await tx
        .update(combatV6Beasts)
        .set({
          individual: {
            ...beast,
            currentLifespan: beast.maxLifespan,
            revision: beast.revision + 1,
          },
        })
        .where(eq(combatV6Beasts.id, id));
    return readBeastRoster(cultivatorId, tx);
  });
}
