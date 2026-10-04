import type { RewardDisplayItem } from '@daoyou/game-domain/rewards';
import { createRewardSchemas, type RewardSelection } from '@daoyou/game-domain/rewards';
export const { RewardItemSchema, RewardSelectionsSchema } = createRewardSchemas({ ItemGrantSchema, InventoryItemSchema, InventoryEquipmentSchema, findItemDefinition });





import { type ItemGrant } from '@daoyou/game-domain/inventory';


import { InventoryItemSchema, ItemGrantSchema } from '../inventory/index.js';


import { InventoryEquipmentSchema } from '../inventory/equipment.js';


import { findItemDefinition } from '@daoyou/game-content/items';


import type { MailAttachment } from '@daoyou/game-domain/mail';


export function rewardItemName(grant: ItemGrant): string {
  return (
    grant.instanceData?.name ??
    findItemDefinition(grant.definitionId)?.name ??
    grant.definitionId
  );
}


export function rewardDisplayItem(grant: ItemGrant): RewardDisplayItem {
  return {
    ...grant,
    name: rewardItemName(grant),
    instanceData: grant.instanceData ?? null,
  };
}


/** Frozen facts are copied, never rolled again. The host supplies each delivery's identity. */
export function materializeRewardItem(
  grant: ItemGrant,
  id: () => string,
): ItemGrant {
  if (grant.definitionId !== 'equipment.v6') return structuredClone(grant);
  return {
    ...grant,
    instanceData: {
      ...InventoryEquipmentSchema.parse(grant.instanceData),
      id: id(),
    },
  };
}


export function rewardAttachments(
  selections: RewardSelection[],
): MailAttachment[] {
  return RewardSelectionsSchema.parse(selections).map((selection) =>
    selection.type === 'inventory_v1'
      ? {
          type: 'inventory_v1',
          name: rewardItemName(selection.inventory),
          quantity: selection.inventory.quantity,
          inventory: selection.inventory,
        }
      : {
          ...selection,
          name: selection.type === 'spirit_stones' ? '灵石' : '声望',
        },
  );
}


export function materializeRewardAttachments(
  attachments: MailAttachment[],
  id: () => string,
): MailAttachment[] {
  return attachments.map((attachment) =>
    attachment.type === 'inventory_v1' && attachment.inventory
      ? {
          ...attachment,
          inventory: materializeRewardItem(attachment.inventory, id),
        }
      : structuredClone(attachment),
  );
}
