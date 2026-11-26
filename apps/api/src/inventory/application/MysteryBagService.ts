import type {
  InventoryAction,
  OpenMysteryBagResult,
} from '@daoyou/contracts/inventory';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import { findMysteryBag } from '@daoyou/game-content/items/mystery-bags';
import {
  FORGING_MATERIAL_TYPES,
  type ItemGrant,
} from '@daoyou/game-domain/inventory';
import {
  mysteryBagFallbackMaterial,
  mysteryBagMaxSpiritStones,
  rollMysteryBagItemGrant,
  rollMysteryBagReward,
} from '@daoyou/game-rules/items/mystery-bags';
import {
  libraryMaterialGrant,
  materializeRewardItem,
  rewardDisplayItem,
} from '@daoyou/game-rules/rewards/materials';
import { wandererSuperiorBookIds } from '@daoyou/game-rules/wanderer';
import { sampleMaterialLibraryEntryByPreferences } from '@server/admin/application/MaterialLibraryService.js';
import {
  SPIRIT_STONE_CEILING,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import {
  InventoryError,
  assertInventoryIdle,
  grantInventory,
  inventoryItemOf,
  saveInventoryPlan,
} from '@server/inventory/operations.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators, inventoryItems } from '@server/lib/drizzle/schema.js';
import type { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';

type OpenBag = Extract<InventoryAction, { action: 'open_mystery_bag' }>;
type Draw = ReturnType<typeof rollMysteryBagReward>;
const materialTypes = ['herb', ...FORGING_MATERIAL_TYPES] as const;

async function resolveItemReward(
  reward: Exclude<Draw, { type: 'spirit_stones' }>,
  tx: DbTransaction,
): Promise<ItemGrant> {
  switch (reward.type) {
    case 'item':
    case 'blueprint':
      return materializeRewardItem(
        rollMysteryBagItemGrant(reward, randomInt),
        randomUUID,
      );
    case 'superior_book': {
      const ids = wandererSuperiorBookIds();
      return {
        definitionId: ids[randomInt(ids.length)]!,
        quantity: reward.quantity,
      };
    }
    case 'material': {
      const start = randomInt(materialTypes.length);
      const entry = await sampleMaterialLibraryEntryByPreferences(
        {
          materialTypes: [
            ...materialTypes.slice(start),
            ...materialTypes.slice(0, start),
          ],
          qualities: [reward.rank],
          seed: randomUUID(),
        },
        tx,
      );
      const material = entry
        ? libraryMaterialGrant(entry)
        : {
            definitionId: 'material.v1',
            instanceData: mysteryBagFallbackMaterial(reward.rank),
          };
      return { ...material, quantity: reward.quantity };
    }
  }
}

export function openMysteryBag(
  actor: ActiveCultivatorRef,
  input: OpenBag,
  commands: PlayerCommandExecutor,
) {
  const { cultivatorId, userId } = actor;
  return commands.executeWithLock<OpenMysteryBagResult>({
    cultivatorId,
    userId,
    source: 'inventory-open-mystery-bag',
    requestId: input.requestId,
    idempotency: {
      key: input.requestId,
      fingerprint: `${input.id}:${input.revision}`,
    },
    lock: { context: 'inventory-open-mystery-bag', timeoutMs: 30_000 },
    command: async (tx) => {
      await assertInventoryIdle(cultivatorId, tx);
      const [row] = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.cultivatorId, cultivatorId),
            eq(inventoryItems.id, input.id),
          ),
        );
      if (!row || row.revision !== input.revision)
        throw new InventoryError('物品已变化，请刷新后重试');
      const bag = findMysteryBag(row.definitionId);
      if (!bag || row.location !== 'bag')
        throw new InventoryError('请在随身物品中打开神秘储物袋');

      const maxStones = mysteryBagMaxSpiritStones(bag.id);
      if (maxStones > 0) {
        const [wallet] = await tx
          .select({ balance: cultivators.spirit_stones })
          .from(cultivators)
          .where(
            and(
              eq(cultivators.id, cultivatorId),
              eq(cultivators.userId, userId),
            ),
          );
        if (!wallet || wallet.balance + maxStones > SPIRIT_STONE_CEILING)
          throw new InventoryError(
            '灵石余额接近上限，请先留出足够空间领取奖池中的灵石',
          );
      }

      const item = inventoryItemOf(row);
      await saveInventoryPlan(
        cultivatorId,
        [item],
        item.quantity > 1
          ? [
              {
                ...item,
                quantity: item.quantity - 1,
                revision: item.revision + 1,
              },
            ]
          : [],
        tx,
      );

      const reward = rollMysteryBagReward(bag.id, randomInt);
      const resourceChanges: ResourceChangeDescriptor[] = [
        {
          resourceTopic: 'inventory.bag',
          eventType: 'inventory.mystery_bag.opened',
          operation: 'invalidate',
        },
      ];
      if (reward.type === 'spirit_stones') {
        const quantity = randomInt(reward.min, reward.max + 1);
        const spiritStones = await updateSpiritStones(
          userId,
          cultivatorId,
          quantity,
          tx,
        );
        resourceChanges.push({
          resourceTopic: 'player.currency',
          eventType: 'currency.mystery_bag.reward',
          operation: 'merge',
          payload: { spiritStones },
        });
        return {
          result: { name: '灵石', quantity, destination: 'currency' },
          resourceChanges,
        };
      }

      const grant = await resolveItemReward(reward, tx);
      const items = await grantInventory(cultivatorId, [grant], tx);
      const storage = items.some((item) => item.location === 'storage');
      const inBag = items.some((item) => item.location === 'bag');
      const result: OpenMysteryBagResult = {
        name: rewardDisplayItem(grant).name,
        quantity: grant.quantity,
        destination: storage ? (inBag ? 'bag_and_storage' : 'storage') : 'bag',
      };
      return { result, resourceChanges };
    },
  });
}
