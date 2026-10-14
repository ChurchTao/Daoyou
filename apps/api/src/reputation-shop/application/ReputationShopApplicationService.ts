import type { DbTransaction } from '@server/lib/drizzle/db.js';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import {
  buyReputationShopCart,
  buyReputationShopItem,
} from '@server/reputation-shop/application/ReputationShopService.js';

export function purchaseReputationShopItemCommand(args: {
  id: string;
  userId: string;
  cultivatorId: string;
  requestId: string;
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'reputation_shop_buy',
    idempotency: { key: args.requestId, fingerprint: args.id },
    lock: {
      context: 'reputation-shop-buy',
      timeoutMs: 10_000,
    },
    command: (tx) =>
      executeReputationShopPurchaseCommand({
        ...args,
        tx,
      }),
  });
}

export async function executeReputationShopPurchaseCommand(args: {
  id: string;
  userId: string;
  cultivatorId: string;
  tx: DbTransaction;
}) {
  const purchase = await buyReputationShopItem(args);
  const resourceChanges: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'inventory.bag',
      eventType: 'inventory.reputation.purchased',
      operation: 'invalidate',
    },
    {
      resourceTopic: 'player.currency',
      eventType: 'currency.reputation.spent',
      payload: { reputation: purchase.reputation },
      operation: 'merge',
    },
  ];
  return {
    result: {
      purchasedItem: purchase.item,
      reputation: purchase.reputation,
      destinations: purchase.destinations,
    },
    resourceChanges,
  };
}

function reputationCartFingerprint(args: {
  expectedTotal: number;
  items: Array<{ id: string; count: number }>;
}) {
  return JSON.stringify({
    expectedTotal: args.expectedTotal,
    items: [...args.items].sort((left, right) => left.id.localeCompare(right.id)),
  });
}

export function purchaseReputationShopCartCommand(args: {
  lines: Array<{ id: string; count: number }>;
  expectedTotal: number;
  userId: string;
  cultivatorId: string;
  requestId: string;
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'reputation_shop_buy',
    idempotency: {
      key: args.requestId,
      fingerprint: reputationCartFingerprint({
        expectedTotal: args.expectedTotal,
        items: args.lines,
      }),
    },
    lock: {
      context: 'reputation-shop-buy',
      timeoutMs: 10_000,
    },
    command: (tx) => executeReputationShopCartCommand({ ...args, tx }),
  });
}

export async function executeReputationShopCartCommand(args: {
  lines: Array<{ id: string; count: number }>;
  expectedTotal: number;
  userId: string;
  cultivatorId: string;
  tx: DbTransaction;
}) {
  const purchase = await buyReputationShopCart({
    lines: args.lines,
    expectedTotal: args.expectedTotal,
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    tx: args.tx,
  });
  const resourceChanges: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'inventory.bag',
      eventType: 'inventory.reputation.purchased',
      operation: 'invalidate',
    },
    {
      resourceTopic: 'player.currency',
      eventType: 'currency.reputation.spent',
      payload: { reputation: purchase.reputation },
      operation: 'merge',
    },
  ];
  return {
    result: {
      purchasedItems: purchase.items,
      reputation: purchase.reputation,
      destinations: purchase.destinations,
    },
    resourceChanges,
  };
}
