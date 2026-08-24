import type { DbTransaction } from '@server/lib/drizzle/db';
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
import { resolvePersistentWorldPlayerState } from './BattleStateCoordinator';
import { playerCommandExecutor } from './CommandExecutors';
import { toPlayerStateMutationResponse } from './ResourceMutationResponse';
import { TaskService } from './TaskService';

type DungeonCommand =
  | { kind: 'start'; mapNodeId: string }
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
  | { kind: 'looting-continue' }
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
      : null;
  const cacheKey =
    args.command.kind === 'battle-execute' && args.command.requestId
      ? dungeonBattleResultCacheKey({
          cultivatorId: args.cultivatorId,
          battleId: args.command.battleId,
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
      const prepared = await prepareDungeonCommand(
        args.cultivatorId,
        args.command,
        lease,
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
  tx: DbTransaction;
}): Promise<{ result: T; resourceChanges: ResourceChangeDescriptor[] }> {
  const settlement = await args.persist?.(args.tx);
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
): Promise<unknown> {
  const options = { deferPersistence: true as const, lease };
  switch (command.kind) {
    case 'start':
      return dungeonService.startDungeon(
        cultivatorId,
        command.mapNodeId,
        options,
      );
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
