import type { DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import type { AuctionListRequest } from '@shared/contracts/auction';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { eq } from 'drizzle-orm';
import {
  buyItem,
  cancelListing,
  clearAuctionListingsCache,
  listItem,
} from './AuctionService';
import { playerCommandExecutor } from './CommandExecutors';
import { readCultivatorName } from './cultivator/CultivatorFactsReader';

export async function executeAuctionBuyCommand(args: {
  listingId: string;
  quantity: number;
  buyerCultivatorId: string;
  buyerCultivatorName: string;
  tx: DbTransaction;
}) {
  await buyItem(
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
    result: { message: '成功购入物品，请查收邮件' },
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

export async function executeAuctionListCommand(
  args: Parameters<typeof listItem>[0] & { tx: DbTransaction },
) {
  const { tx, ...input } = args;
  const result = await listItem(input, { tx, deferCacheClear: true });
  return { result, resourceChanges: [] as ResourceChangeDescriptor[] };
}

export async function executeAuctionCancelCommand(args: {
  listingId: string;
  cultivatorId: string;
  tx: DbTransaction;
}) {
  await cancelListing(args.listingId, args.cultivatorId, {
    tx: args.tx,
    deferCacheClear: true,
  });
  return {
    result: { message: '物品已下架，将通过邮件返还' },
    resourceChanges: [],
  };
}

type AuctionActor = {
  userId: string;
  cultivatorId: string;
};

export async function buyAuctionListing(args: {
  actor: AuctionActor;
  listingId: string;
  quantity: number;
  requestId: string;
}) {
  const committed = await withRedisLock(
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
      playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'auction_buy',
        idempotency: {
          key: `auction-buy:${args.listingId}:${args.requestId}`,
          fingerprint: `${args.actor.cultivatorId}:${args.listingId}:${args.quantity}`,
        },
        command: async (tx) => {
          const { name } = await readCultivatorName(
            args.actor.cultivatorId,
            tx,
          );
          return executeAuctionBuyCommand({
            listingId: args.listingId,
            quantity: args.quantity,
            buyerCultivatorId: args.actor.cultivatorId,
            buyerCultivatorName: name,
            tx,
          });
        },
      }),
  );
  await clearAuctionListingsCache();
  return committed;
}

export async function listAuctionItem(
  args: AuctionListRequest & { actor: AuctionActor },
) {
  const committed = await playerCommandExecutor.executeWithLock({
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
      const { name } = await readCultivatorName(args.actor.cultivatorId, tx);
      return executeAuctionListCommand({
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
  await clearAuctionListingsCache();
  return committed;
}

export async function cancelAuctionListing(args: {
  actor: AuctionActor;
  listingId: string;
}) {
  const committed = await withRedisLock(
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
      playerCommandExecutor.execute({
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
          executeAuctionCancelCommand({
            listingId: args.listingId,
            cultivatorId: args.actor.cultivatorId,
            tx,
          }),
      }),
  );
  await clearAuctionListingsCache();
  return committed;
}
