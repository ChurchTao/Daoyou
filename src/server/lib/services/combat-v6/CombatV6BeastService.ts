import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  combatV6BeastLineups,
  combatV6Beasts,
} from '@server/lib/drizzle/schema';
import { hasActiveDungeon } from '@server/lib/dungeon/occupancy';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  readBeastOwner,
  readBeastRoster,
} from '@server/lib/repositories/combatV6BeastRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  BEAST_SPECIES,
  BeastLineupSchema,
  canDeployBeast,
  generateStarterBeast,
  type BeastLineup,
} from '@shared/engine/combat-v6/beasts';
import {
  allocateBeast,
  BEAST_CAPACITY,
  beastRestCost,
  type BeastAllocationSchema,
} from '@shared/engine/combat-v6/beasts/progression';
import { eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { updateSpiritStones } from '../cultivator/CultivatorStateRepository';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { arenaOccupancyKey } from './CombatV6ArenaStore';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { CombatV6WildStore } from './CombatV6WildStore';

export class BeastError extends Error {
  readonly status = 409;
}

async function mutate<T>(
  cultivatorId: string,
  action: (tx: DbTransaction) => Promise<T>,
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
          (await hasActiveDungeon(cultivatorId)) ||
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
    if (roster.beasts.length >= BEAST_CAPACITY)
      throw new BeastError('灵兽持有已满');
    const beast = generateStarterBeast(
      randomUUID(),
      cultivatorId,
      speciesId,
      randomInt(0, 0x7fffffff),
    );
    await tx
      .insert(combatV6Beasts)
      .values({ id: beast.id, cultivatorId, individual: beast });
    const canCarry = roster.lineup.carriedBeastIds.length < 6;
    const lineup = {
      carriedBeastIds: canCarry
        ? [...roster.lineup.carriedBeastIds, beast.id]
        : roster.lineup.carriedBeastIds,
      leadBeastId:
        roster.lineup.leadBeastId ??
        (canCarry && canDeployBeast(beast, roster.ownerLevel)
          ? beast.id
          : undefined),
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
        (b) =>
          b.id === lineup.leadBeastId && canDeployBeast(b, roster.ownerLevel),
      )
    )
      throw new BeastError('等级或寿命不满足出战条件，不能设为首发');
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
    if (beast.currentLifespan < beast.maxLifespan) {
      const cost = beastRestCost(beast);
      if (roster.spiritStones < cost)
        throw new BeastError(`灵石不足，需要 ${cost}`);
      const owner = await readBeastOwner(cultivatorId, tx);
      const spiritStones = await updateSpiritStones(
        owner.userId,
        cultivatorId,
        -cost,
        tx,
      );
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
      await new ResourceEventCommitter().commit(tx, {
        actor: { userId: owner.userId, cultivatorId },
        source: 'combat-v6-beast-rest',
        scopeDefaults: { cultivatorId },
        changes: [
          {
            resourceTopic: 'player.currency',
            operation: 'merge',
            eventType: 'currency.spirit_stones.changed',
            payload: { spiritStones },
          },
        ],
      });
    }
    return readBeastRoster(cultivatorId, tx);
  });
}

export async function allocateBeastPoints(
  cultivatorId: string,
  id: string,
  revision: number,
  points: z.infer<typeof BeastAllocationSchema>,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const beast = roster.beasts.find((b) => b.id === id);
    if (!beast || beast.revision !== revision)
      throw new BeastError('灵兽状态已变化，请刷新后重试');
    let next;
    try {
      next = allocateBeast(beast, points, roster.ownerLevel);
    } catch (e) {
      throw new BeastError(e instanceof Error ? e.message : '加点无效');
    }
    await tx
      .update(combatV6Beasts)
      .set({ individual: next })
      .where(eq(combatV6Beasts.id, id));
    return readBeastRoster(cultivatorId, tx);
  });
}

export async function releaseBeast(
  cultivatorId: string,
  id: string,
  revision: number,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const beast = roster.beasts.find((b) => b.id === id);
    if (!beast || beast.revision !== revision)
      throw new BeastError('灵兽状态已变化，请刷新后重试');
    if (roster.lineup.leadBeastId === id) throw new BeastError('请先取消首发');
    await tx
      .update(combatV6BeastLineups)
      .set({
        lineup: {
          ...roster.lineup,
          carriedBeastIds: roster.lineup.carriedBeastIds.filter(
            (value) => value !== id,
          ),
          revision: roster.lineup.revision + 1,
        },
      })
      .where(eq(combatV6BeastLineups.cultivatorId, cultivatorId));
    await tx.delete(combatV6Beasts).where(eq(combatV6Beasts.id, id));
    return readBeastRoster(cultivatorId, tx);
  });
}
