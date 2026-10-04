import type { MarketBuyInput } from '@daoyou/contracts/market';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service.js';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { findPlayerMutationRequest } from '@server/lib/repositories/playerStateRepository.js';
import {
  markMarketPurchased,
  prepareBatchMarketPurchase,
} from '@server/market/application/MarketService.js';
import type { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { eq } from 'drizzle-orm';

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
        resourceTopic: 'inventory.bag',
        eventType: 'inventory.market.purchased',
        operation: 'invalidate',
      },
      {
        resourceTopic: 'player.currency',
        eventType: 'currency.market.spent',
        operation: 'merge',
        payload: { spiritStones: currency.spiritStones },
      },
    ],
  };
}

type MarketActor = {
  userId: string;
  cultivatorId: string;
};

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

export class MarketPurchaseService {
  constructor(
    private readonly facts: CultivatorQueriesService,
    private readonly commands: PlayerCommandExecutor,
    private readonly database: DbClient,
  ) {}

  async purchase(args: {
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
          this.database,
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
              cultivatorRealm: (await this.facts.realm(actor.cultivatorId))
                .realm,
              fates: await this.facts.preHeavenFates(
                actor.userId,
                actor.cultivatorId,
              ),
            });
        const committed = await this.commands.execute({
          coordination: { mode: 'redis', lease },
          userId: actor.userId,
          cultivatorId: actor.cultivatorId,
          source,
          idempotency: { key: input.requestId, fingerprint },
          command: async (tx) => {
            if (!prepared) throw new Error('购买凭据已失效，请重新选购');
            return executeMarketPurchaseCommand(
              prepared,
              tx,
              actor.cultivatorId,
            );
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
}
