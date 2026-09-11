import { z } from 'zod';
import { BAG_CAPACITY, InventoryItemSchema } from '../../inventory';
import type { InventoryView } from '../inventory';

export interface BagResourceDataMap {
  'inventory.bag': InventoryView;
}

// Inventory views contain presentation facts (notably seeds), not raw item instances.
export const inventoryBagSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            ...InventoryItemSchema.shape,
            location: z.literal('bag'),
            slotIndex: z
              .number()
              .int()
              .min(0)
              .max(BAG_CAPACITY - 1),
            name: z.string(),
            equipped: z.boolean(),
          })
          .strict(),
      )
      .max(BAG_CAPACITY),
    used: z.number().int().min(0).max(BAG_CAPACITY),
    total: z.number().int().min(0).max(BAG_CAPACITY),
    capacity: z.literal(BAG_CAPACITY),
    page: z.literal(0),
  })
  .strict();
