import { consumables, materials } from '@server/lib/drizzle/schema';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { and, eq } from 'drizzle-orm';
import { playerCommandExecutor } from './CommandExecutors';
import { MarketServiceError } from './MarketService';

type Actor = { userId: string; cultivatorId: string };

export function discardInventoryItem(args: {
  actor: Actor;
  itemId: string;
  itemType: 'material' | 'consumable';
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'inventory_discard',
    command: async (tx) => {
      const table = args.itemType === 'consumable' ? consumables : materials;
      const result = await tx
        .delete(table)
        .where(
          and(
            eq(table.id, args.itemId),
            eq(table.cultivatorId, args.actor.cultivatorId),
          ),
        )
        .returning();
      if (result.length === 0) {
        throw new MarketServiceError(404, '物品未找到或无法删除');
      }
      const resourceTopic =
        args.itemType === 'consumable'
          ? 'inventory.consumables'
          : 'inventory.materials';
      const resourceChanges: ResourceChangeDescriptor[] = [
        {
          resourceTopic,
          eventType: 'inventory.item.discarded',
          operation: 'remove-items',
          payload: { idKey: 'id', ids: [args.itemId] },
        },
      ];
      return { result: { message: '物品已丢弃' }, resourceChanges };
    },
  });
}
