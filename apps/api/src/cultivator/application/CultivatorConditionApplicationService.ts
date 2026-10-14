import { hasActiveDungeon } from '@server/dungeon/occupancy.js';
import { findItemDefinition } from '@daoyou/game-content/items';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import {
  BEAST_LURE_SEARCHES,
  igniteBeastLure,
} from '@daoyou/game-rules/combat/wild';
import { recordJournalChange } from '@server/player/application/JournalSettlement.js';
import { RESOURCE_DATA_SCHEMAS } from '@server/lib/resources/schemas.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { loadPlayerInnRecoveryFacts } from '@server/cultivator/application/readers/CultivatorConditionFactsReader.js';
import { readMarrowWashFacts } from '@server/cultivator/application/readers/CultivatorFactsReader.js';
import { getCultivatorConsumableById } from '@server/cultivator/application/readers/CultivatorInventoryRepository.js';
import { setSpiritualRootMarrowWashBonus } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import { updateCultivator } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { stripExpCapForStorage } from '@daoyou/game-rules/cultivation';
import {
  breakthroughMarrowWash,
  MARROW_WASH_BREAKTHROUGH_QI_COST,
  SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
} from '@daoyou/game-rules/body-cultivation/training';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { randomUUID } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { inventoryItems } from '@server/lib/drizzle/schema.js';
import { loadPlayerBodyCultivationFacts } from '@server/cultivator/application/BodyCultivationBreakthroughService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { ConsumableUseEngine } from '@server/inventory/application/ConsumableUseEngine.js';
import {
  bodyBreakthroughChanges,
  conditionChangesAfterConsumable,
  innRecoveryChanges,
  marrowWashBreakthroughChanges,
} from '@server/cultivator/application/CultivatorConditionResourceChanges.js';
import { InnRecoveryService } from '@server/cultivator/application/InnRecoveryService.js';
import { readPlayerTaskSummary } from '@server/player/application/PlayerResourceReaderService.js';
import { QiService } from '@server/cultivator/application/QiService.js';
import { TaskService } from '@server/tasks/application/TaskService.js';

type Actor = { userId: string; cultivatorId: string };

async function igniteBagBeastLure(
  actor: Actor,
  item: typeof inventoryItems.$inferSelect,
  quantity: number,
  tx: DbTransaction,
): Promise<{
  result: { message: string };
  resourceChanges: ResourceChangeDescriptor[];
}> {
  if (quantity !== 1) throw new Error('引妖香一次点燃一份');
  if (item.quantity < 1) throw new Error('引妖香不足');
  if (await hasActiveDungeon(actor.cultivatorId)) {
    throw new Error(
      '秘境休整期间仅可使用恢复气血或法力的丹药，战斗与结算期间不可使用',
    );
  }
  const [stored] = await tx
    .select({ condition: cultivators.condition })
    .from(cultivators)
    .where(eq(cultivators.id, actor.cultivatorId))
    .limit(1);
  const condition = stored?.condition;
  if (
    !condition ||
    typeof condition !== 'object' ||
    !('version' in condition) ||
    condition.version !== 1 ||
    !('statuses' in condition) ||
    !Array.isArray(condition.statuses)
  ) {
    throw new Error('角色状态尚未初始化，暂时不能点燃引妖香');
  }
  const next = RESOURCE_DATA_SCHEMAS['player.condition'].parse(
    igniteBeastLure(condition as CultivatorCondition),
  );
  const filter = and(
    eq(inventoryItems.id, item.id),
    eq(inventoryItems.cultivatorId, actor.cultivatorId),
    eq(inventoryItems.revision, item.revision),
  );
  if (item.quantity === 1) await tx.delete(inventoryItems).where(filter);
  else
    await tx
      .update(inventoryItems)
      .set({ quantity: item.quantity - 1, revision: item.revision + 1 })
      .where(filter);
  await tx
    .update(cultivators)
    .set({ condition: next })
    .where(eq(cultivators.id, actor.cultivatorId));
  recordJournalChange(tx, actor.cultivatorId, {
    kind: 'item',
    id: item.id,
    name: '引妖香',
    amount: -1,
  });
  return {
    result: {
      message: `已点燃引妖香，接下来 ${BEAST_LURE_SEARCHES} 次寻觅更容易遇见稀有异兽与变异灵兽。`,
    },
    resourceChanges: [
      {
        resourceTopic: 'inventory.bag',
        eventType: 'inventory.beast_lure.used',
        operation: 'invalidate',
      },
      {
        resourceTopic: 'player.condition',
        eventType: 'condition.beast_lure.changed',
        operation: 'replace',
        payload: next,
      },
    ],
  };
}

export function consumeCultivatorConsumable(args: {
  actor: Actor;
  consumableId: string;
  revision?: number;
  quantity: number;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
      context: 'consumable-use',
      timeoutMs: 30_000,
      retries: 0,
    },
    (lease) =>
      playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'consumable_use',
        command: async (tx) => {
          const [item] = await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.id, args.consumableId),
                eq(inventoryItems.cultivatorId, args.actor.cultivatorId),
                eq(inventoryItems.location, 'bag'),
              ),
            )
            .for('update');
          if (
            !item ||
            (args.revision !== undefined && item.revision !== args.revision)
          )
            throw new Error('物品已变化，请刷新后重试');
          if (findItemDefinition(item.definitionId)?.kind === 'beast_lure') {
            return igniteBagBeastLure(args.actor, item, args.quantity, tx);
          }
          const result = await ConsumableUseEngine.consume(
            args.actor.userId,
            args.actor.cultivatorId,
            args.consumableId,
            { tx, lease, quantity: args.quantity },
          );
          const [state] = await tx
            .select({
              condition: cultivators.condition,
              cultivationProgress: cultivators.cultivation_progress,
              realm: cultivators.realm,
              realmStage: cultivators.realm_stage,
              spiritStones: cultivators.spirit_stones,
              qi: cultivators.qi,
              qiLastRefreshedAt: cultivators.qiLastRefreshedAt,
              lifespan: cultivators.lifespan,
              vitality: cultivators.vitality,
              strength: cultivators.strength,
              spirit: cultivators.spirit,
              endurance: cultivators.endurance,
              speed: cultivators.speed,
              willpower: cultivators.willpower,
              unallocatedAttributePoints:
                cultivators.unallocatedAttributePoints,
            })
            .from(cultivators)
            .where(eq(cultivators.id, args.actor.cultivatorId))
            .limit(1);
          if (!state) throw new Error('角色不存在');
          await TaskService.syncCultivatorTasks(args.actor.cultivatorId, tx);
          const remainingConsumable = await getCultivatorConsumableById(
            args.actor.cultivatorId,
            args.consumableId,
            tx,
          );
          const taskSummary = await readPlayerTaskSummary(
            args.actor.cultivatorId,
            tx,
          );
          return {
            result: {
              message: result.message,
              consumable: result.consumable,
            },
            resourceChanges: conditionChangesAfterConsumable({
              consumable: result.consumable,
              remainingConsumable,
              taskSummary,
              state: {
                ...state,
                realm: state.realm as RealmType,
                realmStage: state.realmStage as RealmStage,
                spiritualRoots: result.profilePatch?.spiritual_roots,
              },
            }),
          };
        },
      }),
  );
}

export async function recoverCultivatorAtInn(args: { actor: Actor }) {
  const cultivator = await loadPlayerInnRecoveryFacts(
    args.actor.userId,
    args.actor.cultivatorId,
  );
  if (!cultivator) throw new Error('角色不存在');
  const recovery = InnRecoveryService.buildRecoveryResult(cultivator);
  return playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'inn_recovery',
    command: async (tx) => {
      const [updated] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} - ${recovery.spiritStoneCost}`,
          cultivation_progress: stripExpCapForStorage(
            recovery.nextCultivationProgress,
          ),
          condition: recovery.nextCondition,
        })
        .where(
          and(
            eq(cultivators.id, args.actor.cultivatorId),
            sql`${cultivators.spirit_stones} >= ${recovery.spiritStoneCost}`,
          ),
        )
        .returning({
          spiritStones: cultivators.spirit_stones,
        });
      if (!updated) {
        throw new Error(
          `囊中羞涩，灵石不足（至少需要 ${recovery.spiritStoneCost} 灵石）`,
        );
      }
      return {
        result: {
          cultivator: {
            ...cultivator,
            spirit_stones: updated.spiritStones,
            cultivation_progress: recovery.nextCultivationProgress,
            condition: recovery.nextCondition,
          },
          spiritStoneCost: recovery.spiritStoneCost,
          cultivationLossPercent: recovery.cultivationLossPercent,
          cultivationLossAmount: recovery.cultivationLossAmount,
          clearedStatusCount: recovery.clearedStatusCount,
        },
        resourceChanges: innRecoveryChanges({
          condition: recovery.nextCondition,
          spiritStones: updated.spiritStones,
          progress: recovery.nextCultivationProgress,
        }),
      };
    },
  });
}

export async function breakthroughBodyCultivation(args: { actor: Actor }) {
  return playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'body_cultivation_breakthrough',
    command: async (tx) => {
      const cultivator = await loadPlayerBodyCultivationFacts(
        args.actor.userId,
        args.actor.cultivatorId,
        tx,
      );
      if (!cultivator) throw new Error('角色不存在');
      const result = ConditionService.breakthroughBodyCultivationRealm(
        cultivator,
        cultivator.condition,
      );
      const saved = await updateCultivator(
        args.actor.cultivatorId,
        { condition: result.condition },
        tx,
      );
      if (!saved) throw new Error('更新角色数据失败');
      return {
        result: {
          fromRealm: result.fromRealm,
          toRealm: result.toRealm,
          condition: result.condition,
        },
        resourceChanges: bodyBreakthroughChanges({
          condition: result.condition,
        }),
      };
    },
  });
}

export function breakthroughCultivatorMarrowWash(args: { actor: Actor }) {
  const actionInstanceId = randomUUID();
  return playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'marrow_wash_breakthrough',
    command: async (tx) => {
      const cultivator = await readMarrowWashFacts(
        args.actor.userId,
        args.actor.cultivatorId,
        tx,
      );
      if (!cultivator) throw new Error('角色不存在');
      const result = breakthroughMarrowWash(cultivator.condition, {
        cultivatorRealm: cultivator.realm,
      });
      const nextRoots = cultivator.spiritualRoots.map((root) => {
        const baseStrength = root.baseStrength ?? root.strength;
        const nextBonus = Math.min(
          result.toRealm,
          Math.max(0, SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP - baseStrength),
        );
        return {
          ...root,
          baseStrength,
          marrowWashBonus: nextBonus,
          strength: Math.min(
            SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
            baseStrength + nextBonus,
          ),
        };
      });
      const reservation = await QiService.reserveQi({
        cultivatorId: args.actor.cultivatorId,
        action: 'marrow_wash_breakthrough',
        actionInstanceId,
        cost: MARROW_WASH_BREAKTHROUGH_QI_COST,
        metadata: {
          fromRealm: result.fromRealm,
          toRealm: result.toRealm,
          breakthroughLevel: result.breakthroughLevel,
        },
        tx,
      });
      if (
        !(await updateCultivator(
          args.actor.cultivatorId,
          { condition: result.condition },
          tx,
        ))
      ) {
        throw new Error('更新角色数据失败');
      }
      await setSpiritualRootMarrowWashBonus(
        args.actor.userId,
        args.actor.cultivatorId,
        result.toRealm,
        tx,
      );
      await QiService.commitReservation({
        actionInstanceId,
        metadata: { committedAt: new Date().toISOString() },
        tx,
      });
      return {
        result: {
          fromRealm: result.fromRealm,
          toRealm: result.toRealm,
          breakthroughLevel: result.breakthroughLevel,
          qiCost: MARROW_WASH_BREAKTHROUGH_QI_COST,
          qiAfter: reservation.qiAfter,
          condition: result.condition,
          spiritual_roots: nextRoots,
        },
        resourceChanges: marrowWashBreakthroughChanges({
          condition: result.condition,
          spiritualRoots: nextRoots,
          qi: reservation,
        }),
      };
    },
  });
}
