import { z } from 'zod';
import {
  BAG_CAPACITY,
  InventoryItemStructureSchema,
} from '@daoyou/game-domain/inventory';
import type { InventoryView } from '../inventory.js';

export interface BagResourceDataMap {
  'inventory.bag': InventoryView;
}

// Equipped items are returned separately and do not consume bag capacity.
export const inventoryBagSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            ...InventoryItemStructureSchema.shape,
            location: z.literal('bag'),
            slotIndex: z
              .number()
              .int()
              .min(0)
              .max(BAG_CAPACITY - 1),
            name: z.string(),
            updatedAt: z.iso.datetime(),
            equipped: z.boolean(),
          })
          .strict(),
      )
      .max(BAG_CAPACITY),
    equippedItems: z
      .array(
        z
          .object({
            ...InventoryItemStructureSchema.shape,
            location: z.literal('equipped'),
            slotIndex: z.null(),
            definitionId: z.literal('equipment.v6'),
            name: z.string(),
            updatedAt: z.iso.datetime(),
            equipped: z.literal(true),
          })
          .strict(),
      )
      .max(6),
    used: z.number().int().min(0).max(BAG_CAPACITY),
    total: z.number().int().min(0).max(BAG_CAPACITY),
    capacity: z.literal(BAG_CAPACITY),
    page: z.literal(0),
  })
  .strict();
