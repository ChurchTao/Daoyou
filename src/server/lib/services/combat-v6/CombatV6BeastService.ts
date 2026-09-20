import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  cultivatorBeastFusions,
  cultivatorBeastLineups,
  cultivatorBeasts,
} from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  beastIndividualData,
  readBeastOwner,
  readBeastRoster,
} from '@server/lib/repositories/combatV6BeastRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  BeastNameSchema,
  type BeastFusionRequest,
  type BeastFusionResponse,
} from '@shared/contracts/combatV6Beasts';
import {
  BEAST_STARTER_SPECIES,
  BeastLineupSchema,
  canDeployBeast,
  generateStarterBeast,
  type BeastLineup,
} from '@shared/engine/combat-v6/beasts';
import {
  beastFusionReason,
  fuseBeasts,
} from '@shared/engine/combat-v6/beasts/fusion';
import {
  allocateBeast,
  BEAST_CAPACITY,
  beastRestCost,
  type BeastAllocationSchema,
} from '@shared/engine/combat-v6/beasts/progression';
import { and, eq, inArray } from 'drizzle-orm';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { updateSpiritStones } from '../cultivator/CultivatorStateRepository';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { textFilter } from '../textFilter';

import { assertBeastIdle, BeastError } from './BeastMutationGuard';
export { BeastError } from './BeastMutationGuard';

async function fusionRecord(
  cultivatorId: string,
  requestId: string,
  tx: DbExecutor,
) {
  const [record] = await tx
    .select()
    .from(cultivatorBeastFusions)
    .where(
      and(
        eq(cultivatorBeastFusions.cultivatorId, cultivatorId),
        eq(cultivatorBeastFusions.requestId, requestId),
      ),
    );
  return record;
}

export async function readBeastFusion(
  cultivatorId: string,
  requestId: string,
): Promise<BeastFusionResponse | null> {
  const record = await fusionRecord(cultivatorId, requestId, db);
  return record
    ? { view: await readBeastRoster(cultivatorId, db), result: record.result }
    : null;
}

export async function fuseOwnedBeasts(
  cultivatorId: string,
  input: BeastFusionRequest,
): Promise<BeastFusionResponse> {
  const parents = [...input.parents].sort((a, b) =>
    a.beastId.localeCompare(b.beastId),
  );
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(parents.map((p) => [p.beastId, p.expectedRevision])))
    .digest('hex');
  return mutate(cultivatorId, async (tx) => {
    const previous = await fusionRecord(cultivatorId, input.requestId, tx);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new BeastError('此融合请求已用于其他材料');
      return {
        view: await readBeastRoster(cultivatorId, tx),
        result: previous.result,
      };
    }
    const roster = await readBeastRoster(cultivatorId, tx);
    const materials = parents.map((parent) => {
      const beast = roster.beasts.find((b) => b.id === parent.beastId);
      if (!beast || beast.revision !== parent.expectedRevision)
        throw new BeastError('融合材料已变化，请刷新后重新选择');
      return beast;
    });
    const [a, b] = materials;
    const reason = beastFusionReason(a, b, roster.ownerLevel, roster.lineup);
    if (reason) throw new BeastError(reason);
    const result = fuseBeasts(a, b, randomUUID(), randomInt(0, 0x7fffffff));
    const removed = await tx
      .delete(cultivatorBeasts)
      .where(
        and(
          eq(cultivatorBeasts.cultivatorId, cultivatorId),
          inArray(cultivatorBeasts.id, [a.id, b.id]),
        ),
      )
      .returning({ id: cultivatorBeasts.id });
    if (removed.length !== 2) throw new BeastError('融合材料已变化');
    await tx
      .insert(cultivatorBeasts)
      .values({
        id: result.id,
        cultivatorId,
        individual: beastIndividualData(result),
      });
    await tx
      .insert(cultivatorBeastFusions)
      .values({
        id: randomUUID(),
        cultivatorId,
        requestId: input.requestId,
        fingerprint,
        parents: [a, b],
        result,
      });
    return { view: await readBeastRoster(cultivatorId, tx), result };
  });
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
        await assertBeastIdle(cultivatorId);
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
  if (!BEAST_STARTER_SPECIES.some((s) => s.id === speciesId))
    throw new BeastError('该物种不可作为初始伙伴领取');
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
    await tx.insert(cultivatorBeasts).values({
      id: beast.id,
      cultivatorId,
      individual: beastIndividualData(beast),
    });
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
      .insert(cultivatorBeastLineups)
      .values({ cultivatorId, lineup, starterClaimedAt: new Date() })
      .onConflictDoUpdate({
        target: cultivatorBeastLineups.cultivatorId,
        set: { lineup, starterClaimedAt: new Date() },
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
      .insert(cultivatorBeastLineups)
      .values({ cultivatorId, lineup: next })
      .onConflictDoUpdate({
        target: cultivatorBeastLineups.cultivatorId,
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
        .update(cultivatorBeasts)
        .set({
          individual: beastIndividualData({
            ...beast,
            currentLifespan: beast.maxLifespan,
            revision: beast.revision + 1,
          }),
        })
        .where(eq(cultivatorBeasts.id, id));
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
      .update(cultivatorBeasts)
      .set({ individual: beastIndividualData(next) })
      .where(eq(cultivatorBeasts.id, id));
    return readBeastRoster(cultivatorId, tx);
  });
}

export async function renameBeast(
  cultivatorId: string,
  id: string,
  revision: number,
  name: string,
) {
  const filteredName = textFilter.mask(BeastNameSchema.parse(name)).text;
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const beast = roster.beasts.find((entry) => entry.id === id);
    if (!beast || beast.revision !== revision)
      throw new BeastError('灵兽状态已变化，请刷新后重试');
    if (beast.name === filteredName) return roster;
    await tx
      .update(cultivatorBeasts)
      .set({
        individual: beastIndividualData({
          ...beast,
          name: filteredName,
          revision: beast.revision + 1,
        }),
      })
      .where(
        and(
          eq(cultivatorBeasts.id, id),
          eq(cultivatorBeasts.cultivatorId, cultivatorId),
        ),
      );
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
      .update(cultivatorBeastLineups)
      .set({
        lineup: {
          ...roster.lineup,
          carriedBeastIds: roster.lineup.carriedBeastIds.filter(
            (value) => value !== id,
          ),
          revision: roster.lineup.revision + 1,
        },
      })
      .where(eq(cultivatorBeastLineups.cultivatorId, cultivatorId));
    await tx.delete(cultivatorBeasts).where(eq(cultivatorBeasts.id, id));
    return readBeastRoster(cultivatorId, tx);
  });
}
