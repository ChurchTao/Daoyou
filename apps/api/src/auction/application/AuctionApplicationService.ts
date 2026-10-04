import type {
  AuctionBeastListRequest,
  AuctionListRequest,
} from '@daoyou/contracts/auction';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { redisLockKeys, type withRedisLock } from '@server/lib/redis/lock.js';
import type { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { eq } from 'drizzle-orm';
import type { AuctionOperations } from './AuctionService.js';

type AuctionActor = { userId: string; cultivatorId: string };

export class AuctionApplicationService {
  constructor(
    private readonly operations: AuctionOperations,
    private readonly commands: PlayerCommandExecutor,
    private readonly facts: CultivatorQueriesService,
    private readonly withLock: typeof withRedisLock,
  ) {}

  async executeAuctionBuyCommand(args: {
    listingId: string;
    quantity: number;
    buyerCultivatorId: string;
    buyerCultivatorName: string;
    tx: DbTransaction;
  }) {
    await this.operations.buyItem(
      {
        listingId: args.listingId,
        quantity: args.quantity,
        buyerCultivatorId: args.buyerCultivatorId,
        buyerCultivatorName: args.buyerCultivatorName,
      },
      { tx: args.tx, deferCacheClear: true },
    );
    const [currency] = await args.tx
      .select({ spiritStones: cultivators.spirit_stones })
      .from(cultivators)
      .where(eq(cultivators.id, args.buyerCultivatorId))
      .limit(1);
    if (!currency) throw new Error('拍卖结算后角色不存在');
    return {
      result: { message: '购入成功，请查收邮件' },
      resourceChanges: [
        {
          resourceTopic: 'player.currency',
          eventType: 'currency.auction.spent',
          operation: 'merge',
          payload: { spiritStones: currency.spiritStones },
        },
      ] satisfies ResourceChangeDescriptor[],
    };
  }

  async executeAuctionListCommand(
    args: Parameters<AuctionOperations['listItem']>[0] & { tx: DbTransaction },
  ) {
    const { tx, ...input } = args;
    const result = await this.operations.listItem(input, {
      tx,
      deferCacheClear: true,
    });
    return {
      result,
      resourceChanges: [
        {
          resourceTopic: 'inventory.bag',
          eventType: 'inventory.auction.listed',
          operation: 'invalidate',
        },
      ] satisfies ResourceChangeDescriptor[],
    };
  }

  async executeAuctionCancelCommand(args: {
    listingId: string;
    cultivatorId: string;
    tx: DbTransaction;
  }) {
    await this.operations.cancelListing(args.listingId, args.cultivatorId, {
      tx: args.tx,
      deferCacheClear: true,
    });
    return {
      result: { message: '货单已下架，将通过邮件返还' },
      resourceChanges: [],
    };
  }

  async buyAuctionListing(args: {
    actor: AuctionActor;
    listingId: string;
    quantity: number;
    requestId: string;
  }) {
    const committed = await this.withLock(
      {
        keys: [
          redisLockKeys.auctionListing(args.listingId),
          redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
        ],
        context: 'auction-buy',
        timeoutMs: 10_000,
        retries: 0,
      },
      (lease) =>
        this.commands.execute({
          coordination: { mode: 'redis', lease },
          userId: args.actor.userId,
          cultivatorId: args.actor.cultivatorId,
          source: 'auction_buy',
          idempotency: {
            key: `auction-buy:${args.listingId}:${args.requestId}`,
            fingerprint: `${args.actor.cultivatorId}:${args.listingId}:${args.quantity}`,
          },
          command: async (tx) => {
            const { name } = await this.facts.name(args.actor.cultivatorId, tx);
            return this.executeAuctionBuyCommand({
              listingId: args.listingId,
              quantity: args.quantity,
              buyerCultivatorId: args.actor.cultivatorId,
              buyerCultivatorName: name,
              tx,
            });
          },
        }),
    );
    await this.operations.clearCache();
    return committed;
  }

  async listAuctionItem(args: AuctionListRequest & { actor: AuctionActor }) {
    const committed = await this.commands.executeWithLock({
      userId: args.actor.userId,
      cultivatorId: args.actor.cultivatorId,
      source: 'auction_list',
      requestId: args.requestId,
      allowEmpty: true,
      idempotency: {
        key: args.requestId,
        fingerprint: JSON.stringify([
          args.itemId,
          args.revision,
          args.quantity,
          args.price,
          args.visibility,
          args.targetCultivatorId,
        ]),
      },
      lock: {
        context: 'auction-list',
        timeoutMs: 10_000,
      },
      command: async (tx) => {
        const { name } = await this.facts.name(args.actor.cultivatorId, tx);
        return this.executeAuctionListCommand({
          requestId: args.requestId,
          cultivatorId: args.actor.cultivatorId,
          cultivatorName: name,
          revision: args.revision,
          itemId: args.itemId,
          price: args.price,
          quantity: args.quantity,
          visibility: args.visibility,
          targetCultivatorId: args.targetCultivatorId,
          tx,
        });
      },
    });
    await this.operations.clearCache();
    return committed;
  }

  async cancelAuctionListing(args: { actor: AuctionActor; listingId: string }) {
    const committed = await this.withLock(
      {
        keys: [
          redisLockKeys.auctionListing(args.listingId),
          redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
        ],
        context: 'auction-cancel',
        timeoutMs: 10_000,
        retries: 0,
      },
      (lease) =>
        this.commands.execute({
          coordination: { mode: 'redis', lease },
          userId: args.actor.userId,
          cultivatorId: args.actor.cultivatorId,
          source: 'auction_cancel',
          allowEmpty: true,
          idempotency: {
            key: `auction-cancel:${args.listingId}`,
            fingerprint: `${args.actor.cultivatorId}:${args.listingId}`,
          },
          command: (tx) =>
            this.executeAuctionCancelCommand({
              listingId: args.listingId,
              cultivatorId: args.actor.cultivatorId,
              tx,
            }),
        }),
    );
    await this.operations.clearCache();
    return committed;
  }

  async listAuctionBeast(
    args: AuctionBeastListRequest & { actor: AuctionActor },
  ) {
    const committed = await this.commands.executeWithLock({
      userId: args.actor.userId,
      cultivatorId: args.actor.cultivatorId,
      source: 'auction_list_beast',
      allowEmpty: true,
      idempotency: {
        key: `auction-beast:${args.requestId}`,
        fingerprint: JSON.stringify([
          args.beastId,
          args.expectedRevision,
          args.price,
          args.visibility,
          args.targetCultivatorId,
        ]),
      },
      lock: { context: 'auction-list-beast', timeoutMs: 10000 },
      command: async (tx) => {
        const { name } = await this.facts.name(args.actor.cultivatorId, tx);
        const result = await this.operations.listBeast(
          {
            ...args,
            cultivatorId: args.actor.cultivatorId,
            cultivatorName: name,
          },
          tx,
        );
        return {
          result,
          resourceChanges:
            args.visibility === 'private'
              ? [
                  {
                    resourceTopic: 'inventory.bag',
                    eventType: 'inventory.auction.fee',
                    operation: 'invalidate',
                  } satisfies ResourceChangeDescriptor,
                ]
              : [],
        };
      },
    });
    await this.operations.clearCache();
    return committed;
  }
}
