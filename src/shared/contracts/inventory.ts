import { z } from 'zod';
import { BAG_CAPACITY, type InventoryItem } from '../inventory';
import { INVENTORY_MATERIAL_TYPES } from '../items/definitions/materials';
import { QUALITY_VALUES } from '../types/constants';
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
        'inscription',
        'consumable',
      ])
      .default('all'),
    minRank: z.enum(QUALITY_VALUES).optional(),
    maxRank: z.enum(QUALITY_VALUES).optional(),
    materialType: z.enum(INVENTORY_MATERIAL_TYPES).optional(),
    recycleCategory: z
      .enum([
        'all',
        'material',
        'seed',
        'equipment',
        'blueprint',
        'manual_jade',
        'pill',
        'fruit',
      ])
      .optional(),
    recycleMinQuality: z.enum(QUALITY_VALUES).optional(),
    recycleMaxQuality: z.enum(QUALITY_VALUES).optional(),
  })
  .strict()
  .refine(
    (query) =>
      !query.minRank ||
      !query.maxRank ||
      QUALITY_VALUES.indexOf(query.minRank) <=
        QUALITY_VALUES.indexOf(query.maxRank),
    { message: '品质范围无效' },
  )
  .refine(
    (query) =>
      !query.recycleMinQuality ||
      !query.recycleMaxQuality ||
      QUALITY_VALUES.indexOf(query.recycleMinQuality) <=
        QUALITY_VALUES.indexOf(query.recycleMaxQuality),
    { message: '回收品质范围无效' },
  );
export const InventoryActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('feed'),
      ...ref,
      beastId: z.uuid(),
      beastRevision: z.number().int().nonnegative(),
      quantity: z.number().int().min(1).max(99),
    })
    .strict(),
  z
    .object({
      action: z.literal('transfer'),
      ...ref,
      location: z.enum(['bag', 'storage']),
    })
    .strict(),
  z
    .object({
      action: z.literal('transfer_many'),
      items: z
        .array(z.object(ref).strict())
        .min(1)
        .max(BAG_CAPACITY)
        .refine(
          (items) =>
            new Set(items.map((item) => item.id)).size === items.length,
        ),
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
  equippedItems: (InventoryItem & { name: string; equipped: boolean })[];
  used: number;
  total: number;
  page: number;
  capacity: number;
};
