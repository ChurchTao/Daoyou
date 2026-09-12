import { z } from 'zod';
import { BeastSchema, type SummonedBeast } from '../engine/combat-v6/beasts';
import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { SeedFactsSchema } from '../items/definitions/seeds';
import { findItemDefinition } from '../items/registry';
import { InventoryEquipmentSchema } from './equipment';
export { BOOKS } from '../items/definitions/beast-books';

export const BAG_CAPACITY = 40;
export class InventoryRuleError extends Error {}
export function itemDefinition(id: string) {
  const definition = findItemDefinition(id);
  if (definition) return definition;
  throw new InventoryRuleError('未知物品定义');
}
export const InventoryItemSchema = z
  .object({
    id: z.string().min(1).max(160),
    location: z.enum(['bag', 'storage']),
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
  .strict()
  .superRefine((item, ctx) => {
    if ((item.location === 'bag') !== (item.slotIndex !== null))
      ctx.addIssue({ code: 'custom', message: '格位与位置不一致' });
    if (!findItemDefinition(item.definitionId)) {
      ctx.addIssue({ code: 'custom', message: '未知物品定义' });
      return;
    }
    const definition = itemDefinition(item.definitionId);
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
  });
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type ItemGrant = {
  definitionId: string;
  quantity: number;
  instanceData?:
    | z.infer<typeof InventoryEquipmentSchema>
    | z.infer<typeof SeedFactsSchema>
    | z.infer<typeof MaterialFactsSchema>
    | z.infer<typeof ConsumableFactsSchema>;
};
export const ItemGrantSchema = z
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
export function sameStack(a: InventoryItem, b: InventoryItem) {
  return (
    a.definitionId === b.definitionId &&
    a.stackKey !== null &&
    a.stackKey === b.stackKey &&
    itemDefinition(a.definitionId).stackLimit > 1
  );
}
export function emptySlot(items: InventoryItem[]) {
  const used = new Set(
    items.filter((i) => i.location === 'bag').map((i) => i.slotIndex),
  );
  for (let slot = 0; slot < BAG_CAPACITY; slot++)
    if (!used.has(slot)) return slot;
  return null;
}
export function sortBag(items: InventoryItem[]) {
  const bag = items
    .filter((item) => item.location === 'bag')
    .map((item) => ({ ...item }))
    .sort(
      (a, b) =>
        a.definitionId.localeCompare(b.definitionId) ||
        a.id.localeCompare(b.id),
    );
  const merged: InventoryItem[] = [];
  for (const item of bag) {
    for (const target of merged) {
      if (!sameStack(item, target)) continue;
      const amount = Math.min(
        item.quantity,
        itemDefinition(target.definitionId).stackLimit - target.quantity,
      );
      item.quantity -= amount;
      target.quantity += amount;
    }
    if (item.quantity) merged.push(item);
  }
  return [
    ...items.filter((item) => item.location !== 'bag'),
    ...merged.map((item, slotIndex) => ({
      ...item,
      slotIndex,
      revision: item.revision + 1,
    })),
  ];
}
/** Caller supplies fresh identities; no random or persistence effects in planning. */
export function addItems(
  items: InventoryItem[],
  grant: ItemGrant,
  location: 'bag' | 'storage',
  overflow: boolean,
  id: () => string,
  stackKey: string | null,
) {
  if (!Number.isSafeInteger(grant.quantity) || grant.quantity <= 0)
    throw new InventoryRuleError('物品数量无效');
  const limit = itemDefinition(grant.definitionId).stackLimit;
  if (itemDefinition(grant.definitionId).kind === 'equipment') {
    const facts = InventoryEquipmentSchema.parse(grant.instanceData);
    if (grant.quantity !== 1 || items.some((item) => item.id === facts.id))
      throw new InventoryRuleError('独立物品数量或身份无效');
    const slotIndex = location === 'bag' ? emptySlot(items) : null;
    if (location === 'bag' && slotIndex === null && !overflow)
      throw new InventoryRuleError('背包格子不足');
    const item = InventoryItemSchema.parse({
      id: facts.id,
      definitionId: grant.definitionId,
      instanceData: facts,
      stackKey: null,
      quantity: 1,
      location: location === 'bag' && slotIndex === null ? 'storage' : location,
      slotIndex,
      revision: 0,
    });
    return [...items, item];
  }
  const facts =
    grant.definitionId === 'seed.v1'
      ? SeedFactsSchema.parse(grant.instanceData)
      : grant.definitionId === 'material.v1'
        ? MaterialFactsSchema.parse(grant.instanceData)
        : grant.definitionId === 'consumable.v1'
          ? ConsumableFactsSchema.parse(grant.instanceData)
          : null;
  if (!facts && grant.instanceData !== undefined)
    throw new InventoryRuleError('固定物品不能附带个体属性');
  const next = items.map((i) => ({ ...i }));
  let remaining = grant.quantity;
  for (const destination of location === 'bag' && overflow
    ? (['bag', 'storage'] as const)
    : [location]) {
    for (const item of next) {
      if (
        item.location !== destination ||
        item.definitionId !== grant.definitionId ||
        item.stackKey !== stackKey ||
        item.quantity >= limit
      )
        continue;
      const count = Math.min(limit - item.quantity, remaining);
      if (count) {
        item.quantity += count;
        item.revision++;
        remaining -= count;
      }
    }
    while (remaining > 0) {
      const slotIndex = destination === 'bag' ? emptySlot(next) : null;
      if (destination === 'bag' && slotIndex === null) break;
      const quantity = Math.min(limit, remaining);
      next.push({
        id: id(),
        location: destination,
        slotIndex,
        definitionId: grant.definitionId,
        quantity,
        instanceData: facts,
        stackKey,
        revision: 0,
      });
      remaining -= quantity;
    }
  }
  if (remaining) throw new InventoryRuleError('背包格子不足');
  return next;
}
export function learnBeastSkill(
  beast: SummonedBeast,
  definitionId: string,
  ownerLevel: number,
  slot: number,
) {
  const skillId = itemDefinition(definitionId).skillId;
  if (!skillId) throw new InventoryRuleError('该物品不是兽诀');
  if (beast.level > ownerLevel)
    throw new InventoryRuleError('灵兽修为超过人物承载上限，不能培养');
  if (beast.skills.includes(skillId))
    throw new InventoryRuleError('灵兽已拥有该技能');
  if (!Number.isInteger(slot) || slot < 0 || slot >= beast.skillSlotCapacity)
    throw new InventoryRuleError('没有可学习的技能格');
  const skills = [...beast.skills];
  skills[slot] = skillId;
  return BeastSchema.parse({ ...beast, skills, revision: beast.revision + 1 });
}
