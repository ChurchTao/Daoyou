import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import { allowsLocalDevTools } from '@daoyou/contracts/dev-tools-access';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@server/lib/drizzle/db.js';
import {
  cultivatorEquipmentSlots,
  cultivators,
  inventoryItems,
} from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { assertInventoryIdle, InventoryError } from '@server/inventory/operations.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';

/** Only the local bag and its equipment references are cleared; storage is retained. */
export async function clearDevInventoryBag(owner: string) {
  if (!allowsLocalDevTools(getRuntimeEnvironment().APP_ENV, getRuntimeEnvironment().NODE_ENV))
    throw new InventoryError('仅允许纯本地环境使用');
  const committed = await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'dev-inventory',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        const [actor] = await tx
          .select()
          .from(cultivators)
          .where(eq(cultivators.id, owner))
          .for('update');
        if (!actor || actor.status !== 'active')
          throw new InventoryError('活跃角色不存在');
        await assertInventoryIdle(owner);
        const bagFilter = and(
          eq(inventoryItems.cultivatorId, owner),
          eq(inventoryItems.location, 'bag'),
        );
        const items = await tx
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(bagFilter);
        const unequipped = items.length
          ? await tx
              .delete(cultivatorEquipmentSlots)
              .where(
                and(
                  eq(cultivatorEquipmentSlots.cultivatorId, owner),
                  inArray(
                    cultivatorEquipmentSlots.equipmentInstanceId,
                    items.map((item) => item.id),
                  ),
                ),
              )
              .returning({ id: cultivatorEquipmentSlots.equipmentInstanceId })
          : [];
        const removed = await tx
          .delete(inventoryItems)
          .where(bagFilter)
          .returning({ id: inventoryItems.id });
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { cultivatorId: owner },
          source: 'dev-inventory-clear',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            {
              resourceTopic: 'inventory.bag',
              operation: 'invalidate',
              eventType: 'inventory.bag.changed',
            },
            {
              resourceTopic: 'player.profile',
              operation: 'invalidate',
              eventType: 'combat_v6.equipment.changed',
            },
          ],
        });
        lease.assertHeld();
        return {
          data: { removed: removed.length, unequipped: unequipped.length },
          state,
        };
      }),
  );
  publishResourceEvents(committed.state.changes);
  return committed;
}
