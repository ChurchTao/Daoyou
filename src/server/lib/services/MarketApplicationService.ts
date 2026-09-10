import type { DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { findPlayerMutationRequest } from '@server/lib/repositories/playerStateRepository';
import { getPlayerLoadoutByCultivatorId } from '@server/lib/services/cultivator/CultivatorLoadoutReader';
import { getPlayerPreHeavenFates } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import type { MarketBuyInput } from '@shared/contracts/market';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type { PreHeavenFate } from '@shared/types/cultivator';
import type { SellConfirmResponse } from '@shared/types/market';
import { eq } from 'drizzle-orm';
import { playerCommandExecutor } from './CommandExecutors';
import { readCultivatorRealm } from './cultivator/CultivatorFactsReader';
import { prepareSellConfirmation } from './MarketRecycleService';
import {
  markMarketPurchased,
  prepareBatchMarketPurchase,
} from './MarketService';

type PreparedPurchaseCommand<T> = {
  commit(tx: DbTransaction): Promise<{
    result: T;
  }>;
};

export async function executeMarketPurchaseCommand<T>(
  prepared: PreparedPurchaseCommand<T>,
  tx: DbTransaction,
  cultivatorId: string,
): Promise<{
  result: T;
  resourceChanges: ResourceChangeDescriptor[];
}> {
  const committed = await prepared.commit(tx);
  const [currency] = await tx
    .select({ spiritStones: cultivators.spirit_stones })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);
  if (!currency) throw new Error('坊市结算后角色不存在');
  return {
    result: committed.result,
    resourceChanges: [
      {
        resourceTopic: 'player.currency',
        eventType: 'currency.market.spent',
        operation: 'merge',
        payload: { spiritStones: currency.spiritStones },
      },
    ],
  };
}

export async function executeMarketSellCommand(
  prepared: {
    commit(tx: DbTransaction): Promise<
      SellConfirmResponse & {
        afterCommit?: () => Promise<unknown>;
      }
    >;
  },
  tx: DbTransaction,
  cultivatorId: string,
): Promise<{
  result: SellConfirmResponse;
  resourceChanges: ResourceChangeDescriptor[];
  afterCommit?: () => Promise<void>;
}> {
  const { afterCommit, ...result } = await prepared.commit(tx);
  const resourceChanges: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.currency',
      eventType: 'currency.market.gained',
      payload: { spiritStones: result.remainingSpiritStones },
      operation: 'merge',
    },
  ];
  resourceChanges.push({
    resourceTopic: 'inventory.artifacts',
    eventType: 'inventory.market.sold',
    operation: 'remove-items',
    payload: { idKey: 'id', ids: result.soldItems.map((item) => item.id) },
  });
  if (result.itemType === 'artifact') {
    const loadout = await getPlayerLoadoutByCultivatorId(cultivatorId, tx);
    resourceChanges.push({
      resourceTopic: 'player.loadout',
      eventType: 'loadout.market.sold',
      operation: 'replace',
      payload: loadout,
    });
  }
  return {
    result,
    resourceChanges,
    afterCommit: afterCommit
      ? async () => {
          await afterCommit();
        }
      : undefined,
  };
}

type MarketActor = {
  userId: string;
  cultivatorId: string;
};

async function loadMarketFates(actor: MarketActor): Promise<PreHeavenFate[]> {
  return (
    (await getPlayerPreHeavenFates(actor.userId, actor.cultivatorId)) ?? []
  );
}

async function runAfterCommit(
  afterCommit: (() => Promise<void>) | undefined,
  context: Record<string, unknown>,
): Promise<void> {
  if (!afterCommit) return;
  try {
    await afterCommit();
  } catch (error) {
    console.error('市场结算后置副作用失败:', { ...context, error });
  }
}

export async function confirmMarketSell(args: {
  actor: MarketActor;
  sessionId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
      context: 'market-sell',
      timeoutMs: 10_000,
      retries: 0,
    },
    async (lease) => {
      const prepared = await prepareSellConfirmation(
        args.actor.cultivatorId,
        args.sessionId,
      );
      let afterCommit: (() => Promise<void>) | undefined;
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'market_sell',
        command: async (tx) => {
          const command = await executeMarketSellCommand(
            prepared,
            tx,
            args.actor.cultivatorId,
          );
          afterCommit = command.afterCommit;
          return command;
        },
      });
      await runAfterCommit(afterCommit, {
        cultivatorId: args.actor.cultivatorId,
        sessionId: args.sessionId,
      });
      return committed;
    },
  );
}

export async function purchaseMarketItems(args: {
  actor: MarketActor;
  nodeId: string;
  input: MarketBuyInput;
}) {
  const { actor, nodeId, input } = args;
  const fingerprint = JSON.stringify({
    nodeId,
    layer: input.layer,
    expectedTotal: input.expectedTotal,
    ids: input.items.map((item) => item.listingId).sort(),
  });
  const source = 'market_purchase_v6';
  return withRedisLock(
    {
      keys: [
        redisLockKeys.cultivatorMutation(actor.cultivatorId),
        `market:purchase:user:${actor.userId}`,
      ],
      context: 'market-purchase',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const existing = await findPlayerMutationRequest(
        actor.cultivatorId,
        source,
        input.requestId,
      );
      const prepared = existing
        ? undefined
        : await prepareBatchMarketPurchase({
            nodeId,
            layer: input.layer,
            items: input.items,
            expectedTotal: input.expectedTotal,
            userId: actor.userId,
            cultivatorId: actor.cultivatorId,
            cultivatorRealm: (await readCultivatorRealm(actor.cultivatorId))
              .realm,
            fates: await loadMarketFates(actor),
          });
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        source,
        idempotency: { key: input.requestId, fingerprint },
        command: async (tx) => {
          if (!prepared) throw new Error('购买凭据已失效，请重新选购');
          return executeMarketPurchaseCommand(prepared, tx, actor.cultivatorId);
        },
      });
      await runAfterCommit(
        () =>
          markMarketPurchased(
            actor.userId,
            nodeId,
            input.layer,
            input.items.map((item) => item.listingId),
          ),
        { cultivatorId: actor.cultivatorId, requestId: input.requestId },
      );
      return committed;
    },
  );
}
