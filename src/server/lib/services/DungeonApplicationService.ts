import type { DbTransaction } from '@server/lib/drizzle/db';
import { storyIntents, storyThreads } from '@server/lib/drizzle/schema';
import {
  dungeonService,
  type DungeonPersistenceSettlement,
} from '@server/lib/dungeon/service_v2';
import { redis } from '@server/lib/redis';
import {
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock';
import { hasCultivatorRecoveryPill } from '@server/lib/repositories/cultivatorRepository';
import { loadCultivatorCombatInput } from '@server/lib/services/cultivator/CultivatorCombatProjectionReader';
import {
  RESOURCE_DATA_SCHEMAS,
  type ResourceChangeDescriptor,
} from '@shared/contracts/resources';
import { projectBattleUnitEntryState } from '@shared/engine/battle-v5/setup/BattleStateStrategy';
import type { DungeonBattlePlan } from '@shared/lib/dungeon/battlePlan';
import {
  canChallengeDungeonRealm,
  getMapNode,
  isSatelliteNode,
} from '@shared/lib/game/mapSystem';
import {
  evaluateNoviceReadiness,
  type NoviceDungeonReadiness,
} from '@shared/lib/noviceGuidance';
import type { DungeonStoryContext } from '@shared/lib/story/personalStory';
import { TravelStoryIntentPayloadSchema } from '@shared/lib/story/travelStory';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { resolvePersistentWorldPlayerState } from './BattleStateCoordinator';
import { playerCommandExecutor } from './CommandExecutors';
import { toPlayerStateMutationResponse } from './ResourceMutationResponse';
import { TaskService } from './TaskService';
import { hasActiveSectDungeonTask } from './sect-organization/SectDungeonTaskEligibility';

export type DungeonCommand =
  | {
      kind: 'start';
      mapNodeId: string;
      storyContext?: DungeonStoryContext;
      entrySource?: 'sect_task';
    }
  | { kind: 'action'; choiceId: number; actionId?: string }
  | {
      kind: 'recover';
      action:
        | 'retry'
        | 'retry_continue'
        | 'retry_settle'
        | 'safe_retreat'
        | 'force_quit';
    }
  | { kind: 'quit' }
  | { kind: 'looting-continue'; requestId?: string }
  | { kind: 'looting-escape' }
  | { kind: 'battle-abandon'; battleId: string }
  | {
      kind: 'battle-execute';
      battleId: string;
      battlePlan: DungeonBattlePlan;
      requestId?: string;
    };

export class DungeonStartError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
    readonly readiness?: NoviceDungeonReadiness,
  ) {
    super(message);
    this.name = 'DungeonStartError';
  }
}

type DungeonDeferredResult = Record<string, unknown> & {
  persist?: (tx: DbTransaction) => Promise<DungeonPersistenceSettlement | void>;
  afterCommit?: () => Promise<void>;
};

export async function executeDungeonCommand(args: {
  userId: string;
  cultivatorId: string;
  command: DungeonCommand;
}) {
  const source = dungeonCommandSource(args.command);
  const requestId =
    args.command.kind === 'battle-execute'
      ? (args.command.requestId ?? null)
      : args.command.kind === 'looting-continue'
        ? (args.command.requestId ?? null)
        : null;
  const cacheKey =
    args.command.kind === 'battle-execute' && args.command.requestId
      ? dungeonBattleResultCacheKey({
          cultivatorId: args.cultivatorId,
          battleId: args.command.battleId,
          requestId: args.command.requestId,
        })
      : args.command.kind === 'looting-continue' && args.command.requestId
        ? dungeonMutationResultCacheKey({
            cultivatorId: args.cultivatorId,
            source,
            requestId: args.command.requestId,
          })
        : null;
  if (cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;
  }
  const response = await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: source,
      timeoutMs: 240_000,
      retries: 0,
    },
    async (lease) => {
      if (args.command.kind === 'start') {
        await assertDungeonStartReady({
          userId: args.userId,
          cultivatorId: args.cultivatorId,
          mapNodeId: args.command.mapNodeId,
        });
      }
      const waiveStartQi =
        args.command.kind === 'start' &&
        args.command.entrySource === 'sect_task'
          ? await requireActiveSectDungeonTask(args.cultivatorId)
          : false;
      const prepared = await prepareDungeonCommand(
        args.cultivatorId,
        args.command,
        lease,
        waiveStartQi,
      );
      lease.assertHeld();
      const hooks = asDeferredResult(prepared);
      const persist = hooks?.persist;
      const afterCommit = hooks?.afterCommit;
      const result = hooks ? stripDungeonHooks(hooks) : prepared;
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source,
        requestId,
        allowEmpty: true,
        command: (tx) =>
          executeDungeonPersistenceCommand({
            cultivatorId: args.cultivatorId,
            result,
            persist,
            storyContext:
              args.command.kind === 'start'
                ? args.command.storyContext
                : undefined,
            tx,
          }),
      });
      if (afterCommit) await afterCommit();
      return toPlayerStateMutationResponse(committed);
    },
  );
  if (cacheKey) {
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 3600);
  }
  return response;
}

async function requireActiveSectDungeonTask(
  cultivatorId: string,
): Promise<true> {
  if (!(await hasActiveSectDungeonTask(cultivatorId))) {
    throw new DungeonStartError(
      '宗门秘境委托尚未领取、已经完成或已经过期，请返回宗门事务确认。',
      409,
    );
  }
  return true;
}

async function assertDungeonStartReady(args: {
  userId: string;
  cultivatorId: string;
  mapNodeId: string;
}): Promise<void> {
  if (!isSatelliteNode(args.mapNodeId)) {
    throw new DungeonStartError('只有秘境节点可以进行副本挑战', 400);
  }
  const now = new Date();
  const [isFirstDungeonTutorialActive, cultivatorBundle, hasRecoveryPill] =
    await Promise.all([
      TaskService.isFirstDungeonTutorialActive(args.cultivatorId),
      loadCultivatorCombatInput(args.cultivatorId),
      hasCultivatorRecoveryPill(args.cultivatorId),
    ]);
  if (!cultivatorBundle || cultivatorBundle.userId !== args.userId) {
    throw new DungeonStartError('当前没有活跃角色', 404);
  }
  const preparedPlayer = resolvePersistentWorldPlayerState({
    player: cultivatorBundle.cultivator,
    now,
  });
  const cultivator = preparedPlayer.player;
  const selectedNode = getMapNode(args.mapNodeId);
  const selectedNodeRealm =
    selectedNode && 'realm_requirement' in selectedNode
      ? selectedNode.realm_requirement
      : null;
  if (
    selectedNodeRealm &&
    !canChallengeDungeonRealm(cultivator.realm, selectedNodeRealm)
  ) {
    throw new DungeonStartError(
      `当前境界${cultivator.realm}不可挑战${selectedNodeRealm}副本，请先提升大境界`,
      409,
    );
  }
  const entryState = projectBattleUnitEntryState({
    cultivator,
    state: preparedPlayer.playerState,
  });
  const readiness = evaluateNoviceReadiness({
    cultivator,
    selectedNodeRealm,
    hp: entryState.hp,
    mp: entryState.mp,
    isFirstDungeonTutorialActive,
    hasRecoveryPill,
  });
  if (readiness.shouldBlock) {
    throw new DungeonStartError(readiness.reasons.join('；'), 409, readiness);
  }
}

export async function executeDungeonPersistenceCommand<T>(args: {
  cultivatorId: string;
  result: T;
  persist?: (tx: DbTransaction) => Promise<DungeonPersistenceSettlement | void>;
  storyContext?: DungeonStoryContext;
  tx: DbTransaction;
}): Promise<{ result: T; resourceChanges: ResourceChangeDescriptor[] }> {
  const settlement = await args.persist?.(args.tx);
  if (args.storyContext) {
    const runId = (args.result as { state?: { runId?: string } }).state?.runId;
    if (!runId) {
      throw new Error('关联秘境没有生成运行编号');
    }
    if (args.storyContext.sourceType === 'activity_story') {
      const intentId = args.storyContext.activityIntentId;
      if (!intentId) throw new Error('动态异闻秘境缺少关联意图');
      const [intent] = await args.tx
        .select()
        .from(storyIntents)
        .where(
          and(
            eq(storyIntents.id, intentId),
            eq(storyIntents.cultivatorId, args.cultivatorId),
            inArray(storyIntents.status, ['ready', 'delivered']),
          ),
        )
        .for('update')
        .limit(1);
      const payload = intent
        ? TravelStoryIntentPayloadSchema.safeParse(intent.payload).data
        : undefined;
      if (!payload?.linkedDungeon || payload.linkedDungeon.status !== 'ready') {
        throw new Error('异闻关联秘境状态已经变化，请刷新后重试');
      }
      const nextPayload = TravelStoryIntentPayloadSchema.parse({
        ...payload,
        linkedDungeon: {
          ...payload.linkedDungeon,
          status: 'running',
          runId,
        },
      });
      const [bound] = await args.tx
        .update(storyIntents)
        .set({ payload: nextPayload, requiresChoice: false })
        .where(
          and(
            eq(storyIntents.id, intentId),
            eq(storyIntents.cultivatorId, args.cultivatorId),
            inArray(storyIntents.status, ['ready', 'delivered']),
          ),
        )
        .returning({ id: storyIntents.id });
      if (!bound) {
        throw new Error('异闻关联秘境状态已经变化，请刷新后重试');
      }
    } else {
      const threadId = args.storyContext.threadId;
      if (!threadId) throw new Error('个人剧情秘境缺少关联剧情线');
      const [bound] = await args.tx
        .update(storyThreads)
        .set({ linkedRunId: runId })
        .where(
          and(
            eq(storyThreads.id, threadId),
            eq(storyThreads.cultivatorId, args.cultivatorId),
            eq(storyThreads.stage, 'confrontation'),
            eq(storyThreads.status, 'active'),
            isNull(storyThreads.linkedRunId),
          ),
        )
        .returning({ id: storyThreads.id });
      if (!bound) {
        throw new Error('关联剧情状态已经变化，请刷新后重试');
      }
    }
  }
  const resourceChanges: ResourceChangeDescriptor[] = [];

  if (settlement?.condition !== undefined) {
    resourceChanges.push({
      resourceTopic: 'player.condition',
      eventType: 'condition.changed',
      operation: 'replace',
      payload: RESOURCE_DATA_SCHEMAS['player.condition'].parse(
        settlement.condition,
      ),
    });
  }
  if (settlement?.currency && Object.keys(settlement.currency).length > 0) {
    resourceChanges.push({
      resourceTopic: 'player.currency',
      eventType: 'currency.changed',
      operation: 'merge',
      payload: settlement.currency,
    });
  }
  if (settlement?.progress !== undefined) {
    resourceChanges.push({
      resourceTopic: 'player.progress',
      eventType: 'progress.changed',
      operation: 'replace',
      payload: RESOURCE_DATA_SCHEMAS['player.progress'].parse(
        settlement.progress,
      ),
    });
  }
  if (settlement?.profile && Object.keys(settlement.profile).length > 0) {
    resourceChanges.push({
      resourceTopic: 'player.profile',
      eventType: 'profile.changed',
      operation: 'merge',
      payload: { cultivator: settlement.profile },
    });
  }
  for (const inventoryChange of settlement?.inventoryChanges ?? []) {
    resourceChanges.push(
      inventoryChange.operation === 'upsert'
        ? ({
            resourceTopic: `inventory.${inventoryChange.kind}`,
            eventType: 'inventory.dungeon.changed',
            operation: 'upsert-items',
            payload: { idKey: 'id', items: [inventoryChange.item] },
          } as ResourceChangeDescriptor)
        : ({
            resourceTopic: `inventory.${inventoryChange.kind}`,
            eventType: 'inventory.dungeon.changed',
            operation: 'remove-items',
            payload: { idKey: 'id', ids: [inventoryChange.id] },
          } as ResourceChangeDescriptor),
    );
  }
  return { result: args.result, resourceChanges };
}

function dungeonCommandSource(command: DungeonCommand): string {
  switch (command.kind) {
    case 'start':
      return 'dungeon_start';
    case 'action':
      return 'dungeon_action';
    case 'recover':
      return `dungeon_recover_${command.action}`;
    case 'quit':
      return 'dungeon_quit';
    case 'looting-continue':
      return 'dungeon_looting_continue';
    case 'looting-escape':
      return 'dungeon_looting_escape';
    case 'battle-abandon':
      return 'dungeon_battle_abandon';
    case 'battle-execute':
      return 'dungeon_battle_execute';
  }
}

async function prepareDungeonCommand(
  cultivatorId: string,
  command: DungeonCommand,
  lease: RedisLeaseContext,
  waiveStartQi = false,
): Promise<unknown> {
  const options = { deferPersistence: true as const, lease };
  switch (command.kind) {
    case 'start':
      return dungeonService.startDungeon(cultivatorId, command.mapNodeId, {
        ...options,
        storyContext: command.storyContext,
        waiveStartQi,
      });
    case 'action':
      return dungeonService.handleAction(
        cultivatorId,
        command.choiceId,
        command.actionId,
        options,
      );
    case 'recover':
      return dungeonService.recoverDungeon(
        cultivatorId,
        command.action,
        options,
      );
    case 'quit':
      return dungeonService.quitDungeon(cultivatorId, options);
    case 'looting-continue':
      return dungeonService.continueFromLooting(cultivatorId, options);
    case 'looting-escape':
      return dungeonService.escapeFromLooting(cultivatorId, options);
    case 'battle-abandon':
      return dungeonService.abandonBattle(
        cultivatorId,
        command.battleId,
        options,
      );
    case 'battle-execute': {
      const result = await dungeonService.executeBattle(
        cultivatorId,
        command.battleId,
        command.battlePlan,
        options,
      );
      const hooks = result as DungeonDeferredResult;
      return {
        battleResult: result.battleResult,
        callbackData: {
          dungeonState: result.state,
          roundData: result.roundData,
          isFinished: result.isFinished,
          settlement: result.settlement,
          realGains: result.realGains,
        },
        persist: hooks.persist,
        afterCommit: hooks.afterCommit,
      };
    }
  }
}

function asDeferredResult(value: unknown): DungeonDeferredResult | null {
  return value && typeof value === 'object'
    ? (value as DungeonDeferredResult)
    : null;
}

function stripDungeonHooks(
  value: DungeonDeferredResult,
): Record<string, unknown> {
  const result = { ...value };
  delete result.persist;
  delete result.afterCommit;
  return result;
}

function dungeonBattleResultCacheKey(args: {
  cultivatorId: string;
  battleId: string;
  requestId: string;
}): string {
  return `dungeon:battle-result:${args.cultivatorId}:${args.battleId}:${args.requestId}`;
}

function dungeonMutationResultCacheKey(args: {
  cultivatorId: string;
  source: string;
  requestId: string;
}): string {
  return `dungeon:mutation-result:${args.cultivatorId}:${args.source}:${args.requestId}`;
}
