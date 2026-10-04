import { z } from 'zod';
import { isTalismanScenario } from '../consumables/talisman-scenarios.js';
import type { createInventorySchemas } from '../items/inventory.js';
import type { createInventoryEquipmentSchema } from '../equipment/inventory.js';
import type { ItemDefinition } from '../items/definition.js';


export function createRewardSchemas({ ItemGrantSchema, InventoryItemSchema, InventoryEquipmentSchema, findItemDefinition }: { ItemGrantSchema: ReturnType<typeof createInventorySchemas>['ItemGrantSchema']; InventoryItemSchema: ReturnType<typeof createInventorySchemas>['InventoryItemSchema']; InventoryEquipmentSchema: ReturnType<typeof createInventoryEquipmentSchema>; findItemDefinition: (id: string) => ItemDefinition | undefined; }) {
const RewardItemSchema = ItemGrantSchema.superRefine((grant, ctx) => {
  const definition = findItemDefinition(grant.definitionId);
  const equipment =
    definition?.kind === 'equipment'
      ? InventoryEquipmentSchema.safeParse(grant.instanceData)
      : null;
  const result = InventoryItemSchema.safeParse({
    id: equipment?.success ? equipment.data.id : 'reward-preview',
    location: 'storage',
    slotIndex: null,
    definitionId: grant.definitionId,
    quantity:
      definition?.kind === 'equipment'
        ? grant.quantity
        : Math.min(grant.quantity, definition?.stackLimit ?? 1),
    instanceData: grant.instanceData ?? null,
    stackKey: null,
    revision: 0,
  });
  if (!result.success)
    for (const issue of result.error.issues)
      ctx.addIssue({
        code: 'custom',
        path: issue.path,
        message: issue.message,
      });
  if (
    grant.definitionId === 'consumable.v1' &&
    grant.instanceData &&
    'spec' in grant.instanceData
  ) {
    const facts = grant.instanceData;
    const types = { pill: '丹药', talisman: '符箓', spirit_fruit: '灵果' };
    if (facts.type !== types[facts.spec.kind])
      ctx.addIssue({ code: 'custom', message: '消耗品类型与效果不一致' });
    if (
      facts.spec.kind === 'talisman' &&
      !isTalismanScenario(facts.spec.scenario)
    )
      ctx.addIssue({ code: 'custom', message: '符箓玩法已停用' });
  }
});
const RewardSelectionsSchema = z
  .array(
    z.discriminatedUnion('type', [
      z
        .object({
          type: z.literal('spirit_stones'),
          quantity: z.number().int().positive().max(100000000),
        })
        .strict(),
      z
        .object({
          type: z.literal('reputation'),
          quantity: z.number().int().positive().max(100000000),
        })
        .strict(),
      z
        .object({
          type: z.literal('inventory_v1'),
          inventory: RewardItemSchema,
        })
        .strict(),
    ]),
  )
  .max(30);
return { RewardItemSchema, RewardSelectionsSchema };
}


export type RewardSelection = z.infer<ReturnType<typeof createRewardSchemas>['RewardSelectionsSchema']>[number];
