import {
  BeastNameSchema,
  type BeastFusionRequest,
  type BeastFusionResponse,
} from '@daoyou/contracts/beasts';
import { BEAST_STARTER_SPECIES } from '@daoyou/game-content/beasts';
import {
  BeastLineupSchema,
  beastTradePreview,
  type BeastLineup,
  type BeastLocation,
} from '@daoyou/game-domain/beasts';
import {
  beastFusionReason,
  fuseBeasts,
} from '@daoyou/game-rules/beasts/fusion';
import { generateStarterBeast } from '@daoyou/game-rules/beasts/generation';
import {
  allocateBeast,
  BEAST_BAG_CAPACITY,
  BEAST_WAREHOUSE_CAPACITY,
  beastRestCost,
  carriedBeastIds,
  receivedBeastPlacement,
  warehouseBeastCount,
  type BeastAllocationSchema,
} from '@daoyou/game-rules/beasts/growth';
import { canDeployBeast } from '@daoyou/game-rules/beasts/projection';
import { updateSpiritStones } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { readCultivatorPublicIdentity } from '@server/cultivator/facts.js';
import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  cultivatorBeastFusions,
  cultivatorBeastLineups,
  cultivatorBeasts,
} from '@server/lib/drizzle/schema.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  beastIndividualData,
  readBeastOwner,
  readBeastRoster,
  saveBeastLineup,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { textFilter } from '@server/social/application/textFilter.js';
import { StoryService } from '@server/story/application/StoryService.js';
import { and, eq, inArray } from 'drizzle-orm';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';

import {
  assertBeastIdle,
  BeastError,
} from '@server/combat/application/BeastMutationGuard.js';
export { BeastError } from '@server/combat/application/BeastMutationGuard.js';

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
        throw new BeastError('这场融合已经完成');
      return {
        view: await readBeastRoster(cultivatorId, tx),
        result: previous.result,
      };
    }
    const roster = await readBeastRoster(cultivatorId, tx);
    const materials = parents.map((parent) => {
      const beast = roster.beasts.find((b) => b.id === parent.beastId);
      if (!beast || beast.revision !== parent.expectedRevision)
        throw new BeastError('所选灵兽已有变化，请重新选择');
      return beast;
    });
    const [a, b] = materials;
    const reason = beastFusionReason(a, b, roster.ownerLevel);
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
    const placement = receivedBeastPlacement(roster.beasts, roster.lineup, [
      a.id,
      b.id,
    ]);
    if (!placement) throw new BeastError('灵兽袋与仓库都已满');
    await tx.insert(cultivatorBeasts).values({
      id: result.id,
      cultivatorId,
      individual: beastIndividualData(result),
    });
    const before = carriedBeastIds(roster.beasts, roster.lineup);
    const carried = before.filter((id) => id !== a.id && id !== b.id);
    const leadBeastId =
      roster.lineup.leadBeastId === a.id || roster.lineup.leadBeastId === b.id
        ? undefined
        : roster.lineup.leadBeastId;
    if (
      placement === 'bag' ||
      carried.length !== before.length ||
      leadBeastId !== roster.lineup.leadBeastId
    ) {
      await saveBeastLineup(
        cultivatorId,
        {
          carriedBeastIds:
            placement === 'bag' ? [...carried, result.id] : carried,
          leadBeastId,
          revision: roster.lineup.revision + 1,
        },
        tx,
      );
    }
    await tx.insert(cultivatorBeastFusions).values({
      id: randomUUID(),
      cultivatorId,
      requestId: input.requestId,
      fingerprint,
      parents: [a, b],
      result,
    });
    if (result.skills.length > 5) {
      const owner = await readBeastOwner(cultivatorId, tx);
      const identity = await readCultivatorPublicIdentity(cultivatorId, tx);
      await createDomainEvent(
        {
          type: 'beast.exceptional.acquired',
          aggregate: { type: 'beast', id: result.id },
          deduplicationKey: `beast-fusion-rumor:${input.requestId}`,
          data: {
            userId: owner.userId,
            cultivatorId,
            cultivatorName: identity.name,
            source: 'fusion',
            beast: beastTradePreview(result),
          },
        },
        tx,
      );
    }
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
  const claimed = await mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    if (roster.starterClaimed) return { roster, state: null };
    if (
      carriedBeastIds(roster.beasts, roster.lineup).length >= BEAST_BAG_CAPACITY
    )
      throw new BeastError('灵兽袋已满，请先空出空间');
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
    const carried = carriedBeastIds(roster.beasts, roster.lineup);
    const lineup = {
      carriedBeastIds: [...carried, beast.id],
      leadBeastId:
        roster.lineup.leadBeastId ??
        (canDeployBeast(beast, roster.ownerLevel) ? beast.id : undefined),
      revision: roster.lineup.revision + 1,
    };
    await tx
      .insert(cultivatorBeastLineups)
      .values({ cultivatorId, lineup, starterClaimedAt: new Date() })
      .onConflictDoUpdate({
        target: cultivatorBeastLineups.cultivatorId,
        set: { lineup, starterClaimedAt: new Date() },
      });
    const story = await StoryService.reconcile(cultivatorId, tx);
    const state = story
      ? await new ResourceEventCommitter().commit(tx, {
          actor: { cultivatorId },
          source: 'story-starter-beast',
          scopeDefaults: { cultivatorId },
          changes: story.changes,
        })
      : null;
    return { roster: await readBeastRoster(cultivatorId, tx), state };
  });
  if (claimed.state) publishResourceEvents(claimed.state.changes);
  return claimed.roster;
}

export async function updateBeastLineup(
  cultivatorId: string,
  input: BeastLineup,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const lineup = BeastLineupSchema.parse(input);
    if (lineup.revision !== roster.lineup.revision)
      throw new BeastError('携带已变化，请重新安排');
    if (
      lineup.carriedBeastIds.some(
        (id) => !roster.beasts.some((b) => b.id === id),
      )
    )
      throw new BeastError('只能携带自己的灵兽');
    if (warehouseBeastCount(roster.beasts, lineup) > BEAST_WAREHOUSE_CAPACITY)
      throw new BeastError('灵兽仓库已满');
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
      throw new BeastError('灵兽已有变化，请重新查看');
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
      throw new BeastError('灵兽已有变化，请重新查看');
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
      throw new BeastError('灵兽已有变化，请重新查看');
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

export async function setBeastLocked(
  cultivatorId: string,
  id: string,
  revision: number,
  isLocked: boolean,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const beast = roster.beasts.find((entry) => entry.id === id);
    if (!beast || beast.revision !== revision)
      throw new BeastError('灵兽已有变化，请重新查看');
    if (!!beast.isLocked === isLocked) return roster;
    if (beast.revision >= 100000) throw new BeastError('灵兽版本已达上限');
    await tx
      .update(cultivatorBeasts)
      .set({
        individual: beastIndividualData({
          ...beast,
          isLocked,
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
      throw new BeastError('灵兽已有变化，请重新查看');
    if (beast.isLocked) throw new BeastError('灵兽已锁定，请先解锁');
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

export async function placeBeast(
  cultivatorId: string,
  id: string,
  revision: number,
  location: BeastLocation,
) {
  return mutate(cultivatorId, async (tx) => {
    const roster = await readBeastRoster(cultivatorId, tx);
    const beast = roster.beasts.find((entry) => entry.id === id);
    if (!beast || beast.revision !== revision)
      throw new BeastError('灵兽已有变化，请重新查看');
    const carried = carriedBeastIds(roster.beasts, roster.lineup);
    const inBag = carried.includes(id);
    if ((location === 'bag') === inBag) return roster;
    if (location === 'bag' && carried.length >= BEAST_BAG_CAPACITY)
      throw new BeastError('灵兽袋已满，请先空出空间');
    if (
      location === 'warehouse' &&
      warehouseBeastCount(roster.beasts, roster.lineup) >=
        BEAST_WAREHOUSE_CAPACITY
    )
      throw new BeastError('灵兽仓库已满');
    await saveBeastLineup(
      cultivatorId,
      {
        carriedBeastIds:
          location === 'bag'
            ? [...carried, id]
            : carried.filter((value) => value !== id),
        leadBeastId:
          location === 'warehouse' && roster.lineup.leadBeastId === id
            ? undefined
            : roster.lineup.leadBeastId,
        revision: roster.lineup.revision + 1,
      },
      tx,
    );
    return readBeastRoster(cultivatorId, tx);
  });
}
