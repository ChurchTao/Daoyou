import { cultivators } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { loadPlayerInnRecoveryFacts } from '@server/lib/services/cultivator/CultivatorConditionFactsReader';
import { readMarrowWashFacts } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { getCultivatorConsumableById } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { setSpiritualRootMarrowWashBonus } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { updateCultivator } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { stripExpCapForStorage } from '@server/utils/cultivationUtils';
import {
  breakthroughMarrowWash,
  MARROW_WASH_BREAKTHROUGH_QI_COST,
  SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
} from '@shared/lib/marrowWash';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { randomUUID } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  consumeBodyCultivationBreakthroughCosts,
  loadPlayerBodyCultivationFacts,
  planBodyCultivationBreakthroughSelections,
} from './BodyCultivationBreakthroughService';
import { playerCommandExecutor } from './CommandExecutors';
import { ConditionService } from './ConditionService';
import { ConsumableUseEngine } from './ConsumableUseEngine';
import {
  bodyBreakthroughChanges,
  conditionChangesAfterConsumable,
  innRecoveryChanges,
  marrowWashBreakthroughChanges,
} from './CultivatorConditionResourceChanges';
import { InnRecoveryService } from './InnRecoveryService';
import { readPlayerTaskSummary } from './PlayerResourceReaderService';
import { QiService } from './QiService';
import { TaskService } from './TaskService';

type Actor = { userId: string; cultivatorId: string };

export function consumeCultivatorConsumable(args: {
  actor: Actor;
  consumableId: string;
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
          const result = await ConsumableUseEngine.consume(
            args.actor.userId,
            args.actor.cultivatorId,
            args.consumableId,
            { tx, lease },
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

export async function breakthroughBodyCultivation(args: {
  actor: Actor;
  selection: Parameters<typeof planBodyCultivationBreakthroughSelections>[1];
}) {
  const cultivator = await loadPlayerBodyCultivationFacts(
    args.actor.userId,
    args.actor.cultivatorId,
  );
  if (!cultivator) throw new Error('角色不存在');
  const costPlan = await planBodyCultivationBreakthroughSelections(
    cultivator,
    args.selection,
  );
  const result = ConditionService.breakthroughBodyCultivationRealm(
    cultivator,
    cultivator.condition,
  );
  return playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'body_cultivation_breakthrough',
    command: async (tx) => {
      const inventoryChanges = await consumeBodyCultivationBreakthroughCosts(
        args.actor.userId,
        args.actor.cultivatorId,
        costPlan,
        tx,
      );
      const saved = await updateCultivator(
        args.actor.cultivatorId,
        { condition: result.condition },
        tx,
      );
      if (!saved) throw new Error('更新角色数据失败');
      return {
        result: {
          success: result.success,
          fromRealm: result.fromRealm,
          toRealm: result.toRealm,
          chance: result.chance,
          roll: result.roll,
          failedAttempts: result.failedAttempts,
          guaranteeProgress: result.guaranteeProgress,
          condition: result.condition,
        },
        resourceChanges: bodyBreakthroughChanges({
          success: result.success,
          condition: result.condition,
          inventoryChanges,
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
