import { z } from 'zod';
import { BAG_CAPACITY, type InventoryItem } from '../inventory';
const ref = {
  id: z.string().min(1).max(160),
  revision: z.number().int().nonnegative(),
};
export const InventoryQuerySchema = z
  .object({
    location: z.enum(['bag', 'storage']).default('bag'),
    page: z.coerce.number().int().min(0).max(1000000).default(0),
    search: z.string().max(80).default(''),
    kind: z
      .enum([
        'all',
        'seed',
        'beast_book',
        'beast_refinement',
        'equipment',
        'blueprint',
        'material',
        'manual_jade',
        'consumable',
      ])
      .default('all'),
  })
  .strict();
export const InventoryActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('transfer'),
      ...ref,
      location: z.enum(['bag', 'storage']),
    })
    .strict(),
  z
    .object({
      action: z.literal('move'),
      ...ref,
      slot: z
        .number()
        .int()
        .min(0)
        .max(BAG_CAPACITY - 1),
      targetId: z.string().max(160).nullable(),
      targetRevision: z.number().int().nonnegative().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('split'),
      ...ref,
      quantity: z.number().int().positive().max(98),
    })
    .strict(),
  z
    .object({
      action: z.literal('sort'),
      items: z.array(z.object(ref).strict()).max(BAG_CAPACITY),
    })
    .strict(),
  z
    .object({
      action: z.literal('learn'),
      ...ref,
      beastId: z.uuid(),
      beastRevision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal('refine'),
      ...ref,
      beastId: z.uuid(),
      beastRevision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({ action: z.literal('equip'), ...ref, equipped: z.boolean() })
    .strict(),
]);
export type InventoryAction = z.infer<typeof InventoryActionSchema>;
export type InventoryView = {
  items: (InventoryItem & { name: string; equipped: boolean })[];
  used: number;
  total: number;
  page: number;
  capacity: number;
};
