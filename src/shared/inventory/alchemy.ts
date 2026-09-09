import type { MaterialFacts } from '../items/definitions/materials';
import { materialFactsOf } from '../items/material';
import { findItemDefinition } from '../items/registry';
import type { InventoryItem } from './index';
import { inventoryStackIdentity } from './stack-key';

export type AlchemyBagMaterial = MaterialFacts & {
  id: string;
  quantity: number;
  members: Pick<InventoryItem, 'id' | 'revision' | 'quantity' | 'slotIndex'>[];
};
/** Split stacks represent one ingredient, while different material facts remain distinct. */
export function groupAlchemyBagMaterials(
  items: InventoryItem[],
): AlchemyBagMaterial[] {
  const groups = new Map<string, AlchemyBagMaterial>();
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      item.location !== 'bag' ||
      findItemDefinition(item.definitionId)?.kind !== 'material'
    )
      continue;
    const facts = materialFactsOf(item.definitionId, item.instanceData);
    const key = inventoryStackIdentity('material.v1', facts)!;
    const group = groups.get(key) ?? {
      ...facts,
      id: item.id,
      quantity: 0,
      members: [],
    };
    group.quantity += item.quantity;
    group.members.push({
      id: item.id,
      revision: item.revision,
      quantity: item.quantity,
      slotIndex: item.slotIndex,
    });
    groups.set(key, group);
  }
  return [...groups.values()];
}
