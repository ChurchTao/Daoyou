import { z } from 'zod';
import { isTalismanScenario } from '../config/talismanScenarios';
import {
  InventoryItemSchema,
  ItemGrantSchema,
  type ItemGrant,
} from '../inventory';
import { InventoryEquipmentSchema } from '../inventory/equipment';
import { findItemDefinition } from '../items/registry';
import type { MailAttachment } from '../types/mail';

/** Uses bag validation; the quantity is a grant, possibly spanning several stacks. */
export const RewardItemSchema = ItemGrantSchema.superRefine((grant, ctx) => {
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
export const RewardSelectionsSchema = z
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
export type RewardSelection = z.infer<typeof RewardSelectionsSchema>[number];

export function rewardItemName(grant: ItemGrant): string {
  return (
    grant.instanceData?.name ??
    findItemDefinition(grant.definitionId)?.name ??
    grant.definitionId
  );
}
export function rewardDisplayItem(grant: ItemGrant) {
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
