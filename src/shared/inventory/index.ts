import { z } from 'zod';
import {
  BEAST_SKILLS,
  BeastSchema,
  type SummonedBeast,
} from '../engine/combat-v6/beasts';
import { InventoryEquipmentSchema } from './equipment';

export const BAG_CAPACITY = 40;
export class InventoryRuleError extends Error {}
export const BOOKS = [
  'beast.spirit-flame',
  'beast.stone-guard',
  'beast.wind-strike',
  'beast.combo',
  'beast.advanced-combo',
]
  .map((id) => BEAST_SKILLS.find((skill) => skill.id === id)!)
  .map((skill) => ({
    id: `book.${skill.id}`,
    name: `${skill.name}兽诀`,
    kind: 'beast_book' as const,
    skillId: skill.id,
    stackLimit: 99,
  }));
export function itemDefinition(id: string) {
  const book = BOOKS.find((item) => item.id === id);
  if (book) return book;
  if (id === 'equipment.v6')
    return {
      id,
      name: '道装',
      kind: 'equipment' as const,
      stackLimit: 1,
      skillId: undefined,
    };
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
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if ((item.location === 'bag') !== (item.slotIndex !== null))
      ctx.addIssue({ code: 'custom', message: '格位与位置不一致' });
    if (
      item.definitionId !== 'equipment.v6' &&
      !BOOKS.some((book) => book.id === item.definitionId)
    ) {
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
    } else if (item.instanceData !== null)
      ctx.addIssue({ code: 'custom', message: '固定物品不能附带个体属性' });
  });
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type ItemGrant = {
  definitionId: string;
  quantity: number;
  instanceData?: z.infer<typeof InventoryEquipmentSchema>;
};
export const ItemGrantSchema = z
  .object({
    definitionId: z.string(),
    quantity: z.number().int().positive().max(99),
    instanceData: InventoryEquipmentSchema.optional(),
  })
  .strict();
export function sameStack(a: InventoryItem, b: InventoryItem) {
  return (
    a.definitionId === b.definitionId &&
    a.instanceData == null &&
    b.instanceData == null &&
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
      quantity: 1,
      location: location === 'bag' && slotIndex === null ? 'storage' : location,
      slotIndex,
      revision: 0,
    });
    return [...items, item];
  }
  if (grant.instanceData !== undefined)
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
        item.instanceData != null ||
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
        instanceData: null,
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
    throw new InventoryRuleError('灵兽等级超过人物，不能培养');
  if (beast.skills.includes(skillId))
    throw new InventoryRuleError('灵兽已拥有该技能');
  if (!Number.isInteger(slot) || slot < 0 || slot >= beast.skillSlotCapacity)
    throw new InventoryRuleError('没有可学习的技能格');
  const skills = [...beast.skills];
  skills[slot] = skillId;
  return BeastSchema.parse({ ...beast, skills, revision: beast.revision + 1 });
}
/** Independent reward stream supplied by Host; never consumes combat RNG. */
export function rollBeastBooks(
  kills: number,
  random: () => number,
): ItemGrant[] {
  const result: ItemGrant[] = [];
  for (let i = 0; i < kills; i++) {
    if (random() >= 0.03) continue;
    const roll = random();
    const index = roll < 0.96 ? Math.floor(roll / 0.24) : 4;
    result.push({ definitionId: BOOKS[index].id, quantity: 1 });
  }
  return result;
}
