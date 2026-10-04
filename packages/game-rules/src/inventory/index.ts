import {
  BAG_CAPACITY,
  InventoryRuleError,
  createInventorySchemas,
  type InventoryItem,
  type ItemGrant,
  ConsumableFactsSchema,
  MaterialFactsSchema,
  SeedFactsSchema,
} from '@daoyou/game-domain/inventory';





import { BeastSchema } from '../beasts/schema.js';
import { type SummonedBeast } from '@daoyou/game-domain/beasts';












import { findItemDefinition } from '@daoyou/game-content/items';



import { InventoryEquipmentSchema } from './equipment.js';



export { BOOKS } from '@daoyou/game-content/items/beasts';

export const { itemDefinition, InventoryItemSchema, ItemGrantSchema } = createInventorySchemas({ findItemDefinition, InventoryEquipmentSchema });



export function sameStack(a: InventoryItem, b: InventoryItem) {
  return (
    a.definitionId === b.definitionId &&
    a.stackKey !== null &&
    a.stackKey === b.stackKey &&
    itemDefinition(a.definitionId).stackLimit > 1
  );
}



export function emptySlot(
  items: InventoryItem[],
  reservedSlots: readonly number[] = [],
) {
  const used = new Set([
    ...reservedSlots,
    ...items.filter((i) => i.location === 'bag').map((i) => i.slotIndex),
  ]);
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



export function compactStorage(items: InventoryItem[]) {
  const merged: InventoryItem[] = [];
  for (const source of items) {
    const item = { ...source };
    for (const target of merged) {
      if (!sameStack(item, target)) continue;
      const amount = Math.min(
        item.quantity,
        itemDefinition(target.definitionId).stackLimit - target.quantity,
      );
      if (!amount) continue;
      item.quantity -= amount;
      target.quantity += amount;
      target.revision++;
    }
    if (item.quantity) {
      if (item.quantity !== source.quantity) item.revision++;
      merged.push(item);
    }
  }
  return merged;
}



/** Caller supplies fresh identities; no random or persistence effects in planning. */
export function addItems(
  items: InventoryItem[],
  grant: ItemGrant,
  location: 'bag' | 'storage',
  overflow: boolean,
  id: () => string,
  stackKey: string | null,
  reservedSlots: readonly number[] = [],
) {
  if (!Number.isSafeInteger(grant.quantity) || grant.quantity <= 0)
    throw new InventoryRuleError('物品数量无效');
  const limit = itemDefinition(grant.definitionId).stackLimit;
  if (itemDefinition(grant.definitionId).kind === 'equipment') {
    const facts = InventoryEquipmentSchema.parse(grant.instanceData);
    if (grant.quantity !== 1 || items.some((item) => item.id === facts.id))
      throw new InventoryRuleError('独立物品数量或身份无效');
    const slotIndex =
      location === 'bag' ? emptySlot(items, reservedSlots) : null;
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
      const slotIndex =
        destination === 'bag' ? emptySlot(next, reservedSlots) : null;
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
  if (!skillId) throw new InventoryRuleError('该物品不是传承灵印');
  if (beast.level > ownerLevel)
    throw new InventoryRuleError('灵兽修为超过人物承载上限，不能培养');
  if (beast.skills.includes(skillId))
    throw new InventoryRuleError('灵兽已拥有该技能');
  const skillSlotCapacity = Math.max(1, beast.skillSlotCapacity);
  if (!Number.isInteger(slot) || slot < 0 || slot >= skillSlotCapacity)
    throw new InventoryRuleError('没有可替换的技能');
  const skills = [...beast.skills];
  skills[slot] = skillId;
  return BeastSchema.parse({
    ...beast,
    skills,
    skillSlotCapacity,
    revision: beast.revision + 1,
  });
}
