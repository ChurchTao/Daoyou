import { TYPE_DESCRIPTIONS } from '@shared/engine/material/creation/config';
import { itemDefinition, type InventoryItem } from '@shared/inventory';
import { materialFactsOf } from '@shared/items/material';
import { QUALITY_VALUES } from '@shared/types/constants';
import type { DungeonOptionCost } from './types';

/** Resolve all requirements together so overlapping costs cannot spend the same stack twice. */
export function consumeDungeonMaterials(
  inventory: readonly InventoryItem[],
  costs: readonly DungeonOptionCost[],
): InventoryItem[] {
  const remaining = new Map(inventory.map((item) => [item.id, item.quantity]));
  const materials = inventory
    .filter(
      (item) =>
        item.location === 'bag' &&
        itemDefinition(item.definitionId).kind === 'material',
    )
    .map((item) => ({
      item,
      facts: materialFactsOf(item.definitionId, item.instanceData),
    }))
    .sort(
      (a, b) =>
        QUALITY_VALUES.indexOf(a.facts.rank) -
          QUALITY_VALUES.indexOf(b.facts.rank) ||
        (a.item.slotIndex ?? 0) - (b.item.slotIndex ?? 0) ||
        a.item.id.localeCompare(b.item.id),
    );
  // Reserve the narrower requirements first; a generic cost must not take the only named material.
  const requirements = costs
    .filter((cost) => cost.type === 'material')
    .sort(
      (a, b) =>
        Number(Boolean(b.name)) - Number(Boolean(a.name)) ||
        Number(Boolean(b.required_type)) - Number(Boolean(a.required_type)) ||
        QUALITY_VALUES.indexOf(b.required_quality ?? '凡品') -
          QUALITY_VALUES.indexOf(a.required_quality ?? '凡品'),
    );
  for (const cost of requirements) {
    if (!Number.isSafeInteger(cost.value) || cost.value < 0)
      throw new Error('材料数量无效');
    let needed = cost.value;
    for (const { item, facts } of materials) {
      if (
        (cost.name && facts.name !== cost.name) ||
        (cost.required_type && facts.type !== cost.required_type) ||
        QUALITY_VALUES.indexOf(facts.rank) <
          QUALITY_VALUES.indexOf(cost.required_quality ?? '凡品')
      )
        continue;
      const available = remaining.get(item.id)!;
      const used = Math.min(needed, available);
      remaining.set(item.id, available - used);
      needed -= used;
      if (!needed) break;
    }
    if (needed)
      throw new Error(
        `储物袋材料不足：${cost.name ?? (cost.required_type ? TYPE_DESCRIPTIONS[cost.required_type] : '符合要求的材料')}（${cost.required_quality ?? '凡品'}及以上），需要${cost.value}份，还缺${needed}份。请改选行动，或结束探索后从储藏室／宝库取出备料。`,
      );
  }
  return inventory.flatMap((item) => {
    const quantity = remaining.get(item.id)!;
    return quantity === item.quantity
      ? [item]
      : quantity
        ? [{ ...item, quantity, revision: item.revision + 1 }]
        : [];
  });
}
