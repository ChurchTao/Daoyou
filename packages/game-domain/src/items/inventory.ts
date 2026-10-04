import { z } from 'zod';
import type {
  createInventoryEquipmentSchema,
  InventoryEquipment,
} from '../equipment/inventory.js';
import { BAG_CAPACITY, InventoryRuleError } from './bag.js';
import { ConsumableFactsSchema } from './consumable-facts.js';
import type { ItemDefinition } from './definition.js';
import { MaterialFactsSchema } from './material-facts.js';
import { SeedFactsSchema } from './seed-facts.js';

export const InventoryItemStructureSchema = z
  .object({
    id: z.string().min(1).max(160),
    location: z.enum(['bag', 'storage', 'equipped']),
    slotIndex: z
      .number()
      .int()
      .min(0)
      .max(BAG_CAPACITY - 1)
      .nullable(),
    definitionId: z.string().min(1).max(160),
    quantity: z.number().int().positive().max(2147483647),
    instanceData: z.unknown().nullable(),
    stackKey: z.string().nullable(),
    revision: z.number().int().nonnegative(),
  })
  .strict();

export function createInventorySchemas({
  findItemDefinition,
  InventoryEquipmentSchema,
}: {
  findItemDefinition: (id: string) => ItemDefinition | undefined;
  InventoryEquipmentSchema: ReturnType<typeof createInventoryEquipmentSchema>;
}) {
  function itemDefinition(id: string) {
    const definition = findItemDefinition(id);
    if (definition) return definition;
    throw new InventoryRuleError('未知物品定义');
  }

  const InventoryItemSchema = InventoryItemStructureSchema.superRefine(
    (item, ctx) => {
      if ((item.location === 'bag') !== (item.slotIndex !== null))
        ctx.addIssue({ code: 'custom', message: '格位与位置不一致' });
      if (!findItemDefinition(item.definitionId)) {
        ctx.addIssue({ code: 'custom', message: '未知物品定义' });
        return;
      }
      const definition = itemDefinition(item.definitionId);
      if (item.location === 'equipped' && definition.kind !== 'equipment')
        ctx.addIssue({ code: 'custom', message: '仅道装可以处于穿戴位置' });
      if (item.quantity > definition.stackLimit)
        ctx.addIssue({ code: 'custom', message: '超过堆叠上限' });
      if (definition.kind === 'equipment') {
        const equipment = InventoryEquipmentSchema.safeParse(item.instanceData);
        if (!equipment.success || equipment.data.id !== item.id)
          ctx.addIssue({ code: 'custom', message: '道装个体事实无效' });
      } else if (item.definitionId === 'seed.v1') {
        if (!SeedFactsSchema.safeParse(item.instanceData).success)
          ctx.addIssue({ code: 'custom', message: '灵种事实无效' });
      } else if (item.definitionId === 'material.v1') {
        if (!MaterialFactsSchema.safeParse(item.instanceData).success)
          ctx.addIssue({ code: 'custom', message: '材料事实无效' });
      } else if (item.definitionId === 'consumable.v1') {
        if (!ConsumableFactsSchema.safeParse(item.instanceData).success)
          ctx.addIssue({ code: 'custom', message: '消耗品事实无效' });
      } else if (item.instanceData !== null)
        ctx.addIssue({ code: 'custom', message: '固定物品不能附带个体属性' });
    },
  );

  const ItemGrantSchema = z
    .object({
      definitionId: z.string(),
      quantity: z.number().int().positive().max(99),
      instanceData: z
        .union([
          InventoryEquipmentSchema,
          SeedFactsSchema,
          MaterialFactsSchema,
          ConsumableFactsSchema,
        ])
        .optional(),
    })
    .strict();
  return { itemDefinition, InventoryItemSchema, ItemGrantSchema };
}

export type InventoryItem = z.infer<
  ReturnType<typeof createInventorySchemas>['InventoryItemSchema']
>;

export type ItemGrant = {
  definitionId: string;
  quantity: number;
  instanceData?:
    | InventoryEquipment
    | z.infer<typeof SeedFactsSchema>
    | z.infer<typeof MaterialFactsSchema>
    | z.infer<typeof ConsumableFactsSchema>;
};
