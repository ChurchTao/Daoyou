import { consumeLifespanAndHandleDepletion } from '@server/lib/lifespan/handleLifespan';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import {
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock';
import { loadPlayerRetreatFacts } from '@server/lib/services/cultivator/CultivatorConditionFactsReader';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  updateCultivator,
} from '@server/lib/services/cultivator/CultivatorStateRepository';
import type {
  BreakthroughStoryPayload,
  LifespanExhaustedStoryPayload,
} from '@server/utils/prompts';
import { getRetreatQiCost } from '@shared/config/qiSystem';
import { RESOURCE_DATA_SCHEMAS } from '@shared/contracts/resources';
import type { RetreatResultData } from '@shared/contracts/retreat';
import {
  attemptBreakthrough,
  performCultivation,
} from '@shared/engine/cultivation/CultivationEngine';
import type { BreakthroughHistoryEntry } from '@shared/types/cultivator';
import { randomUUID } from 'crypto';
import { playerCommandExecutor } from './CommandExecutors';
import { PillOperationExecutor } from './PillOperationExecutor';
import { QiService } from './QiService';
import { breakthroughChanges, retreatChanges } from './RetreatResourceChanges';
import { sectOrganizationFacade } from './sect-organization';
import { TaskService } from './TaskService';

export type RetreatStorySource =
  | { type: 'breakthrough'; payload: BreakthroughStoryPayload }
  | { type: 'lifespan'; payload: LifespanExhaustedStoryPayload }
  | null;

export class RetreatCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
    readonly payload?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function buildLifespanHistoryEntry(
  payload: LifespanExhaustedStoryPayload,
  story: string,
): BreakthroughHistoryEntry {
  return {
    from_realm: payload.summary.fromRealm,
    from_stage: payload.summary.fromStage,
    to_realm: payload.summary.fromRealm,
    to_stage: payload.summary.fromStage,
    age: payload.cultivator.age,
    years_spent: payload.summary.yearsSpent,
    story: story || undefined,
  };
}

export function executeRetreatCommand(args: {
  userId: string;
  cultivatorId: string;
  action: 'cultivate' | 'breakthrough';
  years: number;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'retreat',
      timeoutMs: 300_000,
      retries: 0,
    },
    async (lease) => {
      await assertCombatV6MutationAllowed(args.cultivatorId, `retreat_${args.action}`);
      const cultivator = await loadPlayerRetreatFacts(
        args.userId,
        args.cultivatorId,
      );
      if (!cultivator) {
        throw new RetreatCommandError('角色不存在', 404);
      }

      if (args.action === 'cultivate') {
        if (
          !Number.isFinite(args.years) ||
          args.years < 1 ||
          args.years > 200
        ) {
          throw new RetreatCommandError('闭关年限需在 1~200 年之间', 400);
        }
        if (cultivator.lifespan - cultivator.age < args.years) {
          throw new RetreatCommandError('道友，您没有这么多寿元了', 400);
        }
        const sectBonuses = await sectOrganizationFacade.getFacilityBonuses(
          args.cultivatorId,
        );
        const result = performCultivation(cultivator, args.years, Math.random, {
          retreatExpMultiplier: sectBonuses.retreatMultiplier,
        });
        const { committed, lifespanStoryPayload } =
          await commitCultivationRetreat({
            userId: args.userId,
            cultivatorId: args.cultivatorId,
            years: args.years,
            result,
            lease,
          });
        return {
          committed,
          storySource: lifespanStoryPayload
            ? ({
                type: 'lifespan',
                payload: lifespanStoryPayload,
              } satisfies RetreatStorySource)
            : null,
          onStoryComplete: lifespanStoryPayload
            ? (story: string) =>
                addBreakthroughHistoryEntry(
                  args.userId,
                  args.cultivatorId,
                  buildLifespanHistoryEntry(lifespanStoryPayload, story),
                )
            : undefined,
        };
      }

      const majorGate = await TaskService.getMajorBreakthroughGate(
        args.cultivatorId,
      );
      if (majorGate.required && majorGate.blocked) {
        throw new RetreatCommandError('大境界突破仍需先完成破境任务', 409, {
          errorCode: 'MAJOR_BREAKTHROUGH_TASK_REQUIRED',
          data: { task: majorGate.task },
        });
      }
      const result = attemptBreakthrough(cultivator);
      result.cultivator.condition =
        PillOperationExecutor.consumeBreakthroughSupportStatuses(
          result.cultivator.condition,
          result.cultivator,
        );
      const storySource: RetreatStorySource = result.summary.success
        ? {
            type: 'breakthrough',
            payload: {
              cultivator: result.cultivator,
              summary: {
                success: result.summary.success,
                isMajor: result.summary.toRealm !== result.summary.fromRealm,
                yearsSpent: 1,
                chance: result.summary.chance,
                roll: result.summary.roll,
                fromRealm: result.summary.fromRealm,
                fromStage: result.summary.fromStage,
                toRealm: result.summary.toRealm,
                toStage: result.summary.toStage,
                lifespanGained: result.summary.lifespanGained,
                attributeGrowth: result.summary.attributeGrowth,
                naturalAttributeGrowth: result.summary.naturalAttributeGrowth,
                attributePointReward: result.summary.attributePointReward,
                lifespanDepleted: false,
                modifiers: result.summary.modifiers,
              },
            },
          }
        : null;
      const retreatResult: RetreatResultData = {
        summary: result.summary,
        storyType: storySource ? 'breakthrough' : null,
        action: 'breakthrough',
      };
      const { committed, domainEventId } = await commitBreakthroughRetreat({
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        result,
        retreatResult,
        lease,
      });
      publishTransactionalMessageBestEffort(domainEventId, {
        source: 'retreat_breakthrough',
        cultivatorId: args.cultivatorId,
      });
      return {
        committed,
        storySource,
        onStoryComplete:
          result.summary.success && result.historyEntry
            ? async (story: string) => {
                if (story) result.historyEntry!.story = story;
                await addBreakthroughHistoryEntry(
                  args.userId,
                  args.cultivatorId,
                  result.historyEntry!,
                );
              }
            : undefined,
      };
    },
  );
}

export async function commitCultivationRetreat(args: {
  userId: string;
  cultivatorId: string;
  years: number;
  result: ReturnType<typeof performCultivation>;
  lease: RedisLeaseContext;
}) {
  const actionInstanceId = randomUUID();
  let streamResult: RetreatResultData = {
    summary: args.result.summary,
    action: 'cultivate',
  };
  let lifespanStoryPayload: LifespanExhaustedStoryPayload | null = null;
  let afterCommit: (() => Promise<void>) | undefined;
  const committed = await playerCommandExecutor.execute({
    coordination: { mode: 'redis', lease: args.lease },
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'retreat_cultivate',
    command: async (tx) => {
      const reservation = await QiService.reserveQi({
        cultivatorId: args.cultivatorId,
        action: 'retreat_10_years',
        actionInstanceId,
        cost: getRetreatQiCost(args.years),
        metadata: { years: args.years, retreatAction: 'cultivate' },
        tx,
      });
      await addRetreatRecord(
        args.userId,
        args.cultivatorId,
        args.result.record,
        tx,
      );
      const next = args.result.cultivator;
      if (
        !(await updateCultivator(
          args.cultivatorId,
          {
            age: next.age,
            closed_door_years_total: next.closed_door_years_total,
            cultivation_progress: next.cultivation_progress,
            condition: next.condition,
          },
          tx,
        ))
      ) {
        throw new Error('更新角色数据失败');
      }
      await QiService.commitReservation({
        actionInstanceId,
        metadata: { committedAt: new Date().toISOString() },
        tx,
      });
      try {
        const lifespan = await consumeLifespanAndHandleDepletion(
          args.cultivatorId,
          args.years,
          {
            tx,
            ageAfterConsumption: next.age,
            storyCultivator: next,
          },
        );
        if (lifespan.depleted) {
          streamResult = {
            ...streamResult,
            storyType: lifespan.storyPayload ? 'lifespan' : null,
            depleted: true,
          };
          lifespanStoryPayload = lifespan.storyPayload ?? null;
          afterCommit = lifespan.afterCommit;
        }
      } catch (error) {
        console.warn('处理寿元耗尽失败：', error);
      }
      return {
        result: streamResult,
        resourceChanges: retreatChanges({
          profile: {
            age: next.age,
            closed_door_years_total: next.closed_door_years_total,
          },
          progress: RESOURCE_DATA_SCHEMAS['player.progress'].parse(
            next.cultivation_progress,
          ),
          condition: RESOURCE_DATA_SCHEMAS['player.condition'].parse(
            next.condition,
          ),
          qi: reservation,
          depleted: Boolean(streamResult.depleted),
        }),
      };
    },
  });
  if (afterCommit) {
    try {
      await afterCommit();
    } catch (error) {
      console.error('闭关寿元耗尽后置副作用失败:', error);
    }
  }
  return { committed, lifespanStoryPayload };
}

export async function commitBreakthroughRetreat(args: {
  userId: string;
  cultivatorId: string;
  result: ReturnType<typeof attemptBreakthrough>;
  retreatResult: RetreatResultData;
  lease: RedisLeaseContext;
}) {
  const actionInstanceId = randomUUID();
  let domainEventId: string | undefined;
  const committed = await playerCommandExecutor.execute({
    coordination: { mode: 'redis', lease: args.lease },
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'retreat_breakthrough',
    command: async (tx) => {
      const reservation = await QiService.reserveQi({
        cultivatorId: args.cultivatorId,
        action: 'breakthrough_attempt',
        actionInstanceId,
        metadata: { retreatAction: 'breakthrough' },
        tx,
      });
      const next = args.result.cultivator;
      if (
        !(await updateCultivator(
          args.cultivatorId,
          {
            realm: next.realm,
            realm_stage: next.realm_stage,
            age: next.age,
            lifespan: next.lifespan,
            attributes: next.attributes,
            unallocated_attribute_points: next.unallocated_attribute_points,
            cultivation_progress: next.cultivation_progress,
            condition: next.condition,
          },
          tx,
        ))
      ) {
        throw new Error('更新角色数据失败');
      }
      if (args.result.summary.success) {
        await QiService.commitReservation({
          actionInstanceId,
          metadata: { committedAt: new Date().toISOString() },
          tx,
        });
      } else {
        await QiService.markNoRefund({
          actionInstanceId,
          reason: 'breakthrough_failed_normally',
          metadata: { committedAt: new Date().toISOString() },
          tx,
        });
      }
      if (args.result.summary.success) {
        const fromRealm = args.result.summary.fromRealm;
        const fromStage = args.result.summary.fromStage;
        const toRealm = args.result.summary.toRealm;
        const toStage = args.result.summary.toStage;
        if (!toRealm || !toStage) {
          throw new Error('突破成功但缺少目标境界');
        }
        domainEventId = (
          await createDomainEvent(
            {
              type: 'cultivator.realm.changed',
              aggregate: { type: 'cultivator', id: args.cultivatorId },
              data: {
                userId: args.userId,
                cultivatorId: args.cultivatorId,
                actionInstanceId,
                cultivatorName: next.name,
                fromRealm,
                fromStage,
                toRealm,
                toStage,
                major: toRealm !== fromRealm,
              },
              deduplicationKey: `${args.cultivatorId}:realm:${actionInstanceId}`,
            },
            tx,
          )
        ).id;
      }
      return {
        result: args.retreatResult,
        resourceChanges: breakthroughChanges({
          profile: {
            realm: next.realm,
            realm_stage: next.realm_stage,
            age: next.age,
            lifespan: next.lifespan,
            attributes: next.attributes,
            unallocated_attribute_points: next.unallocated_attribute_points,
          },
          condition: RESOURCE_DATA_SCHEMAS['player.condition'].parse(
            next.condition,
          ),
          progress: RESOURCE_DATA_SCHEMAS['player.progress'].parse(
            next.cultivation_progress,
          ),
          qi: reservation,
        }),
      };
    },
  });
  return { committed, domainEventId };
}
import { assertCombatV6MutationAllowed } from './combat-v6/CombatV6MutationGuard';
