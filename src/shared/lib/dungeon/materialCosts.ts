import type { DungeonMaterialSelection } from '@shared/contracts/combatV6Dungeon';
import { itemDefinition, type InventoryItem } from '@shared/inventory';
import { materialFactsOf } from '@shared/items/material';
import { QUALITY_VALUES } from '@shared/types/constants';
import type { DungeonOptionCost } from './types';

export function dungeonMaterialMatches(
  item: InventoryItem,
  cost: DungeonOptionCost,
) {
  if (
    cost.type !== 'material' ||
    item.location !== 'bag' ||
    itemDefinition(item.definitionId).kind !== 'material'
  )
    return false;
  const facts = materialFactsOf(item.definitionId, item.instanceData);
  return (
    (!cost.name || facts.name === cost.name) &&
    (!cost.required_type || facts.type === cost.required_type) &&
    QUALITY_VALUES.indexOf(facts.rank) >=
      QUALITY_VALUES.indexOf(cost.required_quality ?? '凡品')
  );
}

/** Consume only explicitly submitted stacks; never substitute another item. */
export function consumeDungeonMaterials(
  inventory: readonly InventoryItem[],
  costs: readonly DungeonOptionCost[],
  selections: readonly DungeonMaterialSelection[] = [],
): InventoryItem[] {
  const remaining = new Map(inventory.map((item) => [item.id, item.quantity]));
  const seen = new Set<number>();
  for (const selection of selections) {
    const cost = costs[selection.costIndex];
    if (!cost || cost.type !== 'material' || seen.has(selection.costIndex))
      throw new Error('提交的材料要求无效');
    seen.add(selection.costIndex);
    let total = 0;
    const itemIds = new Set<string>();
    for (const ref of selection.items) {
      const item = inventory.find((entry) => entry.id === ref.itemId);
      if (!item || !dungeonMaterialMatches(item, cost))
        throw new Error('所选物品不符合要求，请重新选物');
      if (item.revision !== ref.revision)
        throw new Error('所选物品已变化，请刷新选物');
      if (
        !Number.isSafeInteger(ref.quantity) ||
        ref.quantity <= 0 ||
        itemIds.has(ref.itemId)
      )
        throw new Error('提交的材料数量无效');
      itemIds.add(ref.itemId);
      const available = remaining.get(ref.itemId)!;
      if (ref.quantity > available)
        throw new Error('所选物品数量不足，请重新选物');
      remaining.set(ref.itemId, available - ref.quantity);
      total += ref.quantity;
    }
    if (!Number.isSafeInteger(cost.value) || total !== cost.value)
      throw new Error('提交数量须与材料要求一致');
  }
  if (
    costs.some(
      (cost, index) =>
        cost.type === 'material' && cost.value > 0 && !seen.has(index),
    )
  )
    throw new Error('请先选择需要提交的材料');
  return inventory.flatMap((item) => {
    const quantity = remaining.get(item.id)!;
    return quantity === item.quantity
      ? [item]
      : quantity
        ? [{ ...item, quantity, revision: item.revision + 1 }]
        : [];
  });
}
