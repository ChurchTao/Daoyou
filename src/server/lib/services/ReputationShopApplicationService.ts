import type { DbTransaction } from '@server/lib/drizzle/db';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { playerCommandExecutor } from './CommandExecutors';
import { buyReputationShopItem } from './ReputationShopService';

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
