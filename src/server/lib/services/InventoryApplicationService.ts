import { consumables, materials } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { and, eq } from 'drizzle-orm';
import { playerCommandExecutor } from './CommandExecutors';
import {
  MarketServiceError,
  prepareMysteryMaterialIdentification,
} from './MarketService';
import { qiCurrencyChange } from './QiResourceChanges';

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

export function identifyMysteryMaterial(args: {
  actor: Actor;
  materialId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
      context: 'inventory-identify',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) => {
      const prepared = await prepareMysteryMaterialIdentification({
        materialId: args.materialId,
        cultivatorId: args.actor.cultivatorId,
      });
      let afterCommit: (() => Promise<void>) | undefined;
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'inventory_identify',
        command: async (tx) => {
          const command = await prepared.commit(tx);
          afterCommit = command.afterCommit;
          return {
            result: command.result,
            resourceChanges: [
              qiCurrencyChange(
                'currency.qi.material_identified',
                command.result,
              ),
              {
                resourceTopic: 'inventory.materials',
                eventType: 'inventory.material.identified',
                operation: 'upsert-items',
                payload: {
                  idKey: 'id',
                  items: command.inventoryChanges
                    .filter((change) => change.operation === 'upsert')
                    .map((change) => change.item),
                },
              },
              ...command.inventoryChanges
                .filter((change) => change.operation === 'remove')
                .map((change): ResourceChangeDescriptor => ({
                  resourceTopic: 'inventory.materials',
                  eventType: 'inventory.material.identified',
                  operation: 'remove-items',
                  payload: { idKey: 'id', ids: [change.id] },
                })),
            ],
          };
        },
      });
      if (afterCommit) {
        try {
          await afterCommit();
        } catch (error) {
          console.error('鉴定后置副作用失败:', error);
        }
      }
      return committed;
    },
  );
}
