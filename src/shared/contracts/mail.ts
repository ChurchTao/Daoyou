import { z } from 'zod';
import { ItemGrantSchema } from '../inventory';
import { findItemDefinition } from '../items/registry';

export const SendMailSchema = z
  .object({
    requestId: z.string().min(1).max(120),
    recipientCultivatorId: z.uuid(),
    content: z.string().trim().min(1).max(1000),
    attachment: z
      .object({
        itemId: z.uuid(),
        revision: z.number().int().nonnegative(),
        quantity: z.number().int().min(1).max(99),
      })
      .strict()
      .optional(),
  })
  .strict();
export type SendMailRequest = z.infer<typeof SendMailSchema>;
export const MailInventoryGrantSchema = ItemGrantSchema.extend({
  quantity: z.number().int().positive().max(2147483647),
});

export function mailGiftBlockReason(item: {
  definitionId: string;
  equipped?: boolean;
  location: string;
  instanceData: unknown;
}): string | null {
  if (item.location !== 'bag') return '只能附带随身物品';
  if (item.equipped) return '已装备道装不能附带，请先卸下';
  const definition = findItemDefinition(item.definitionId);
  if (!definition) return '该物品不支持赠送';
  if (definition.kind === 'consumable') {
    const facts = item.instanceData as { spec?: { kind?: string } } | null;
    if (!['pill', 'spirit_fruit'].includes(facts?.spec?.kind ?? ''))
      return '当前仅支持丹药与灵果作为消耗品附件';
  }
  return null;
}

export function mailLocationText(locations: string[] = []) {
  return locations
    .map(
      (v) =>
        ({ bag: '随身物品', storage: '储藏室', vault: '洞府宝库' })[v] ?? v,
    )
    .join('、');
}
