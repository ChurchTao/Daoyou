import type { z } from 'zod';
import type { InventoryEquipmentSchema } from '../inventory/equipment';
import { EQUIPMENT_ITEM } from './definitions/equipment';
import type { InventoryShowcaseSnapshot } from './showcase';

export function forgingShowcaseSnapshot(
  equipment: z.infer<typeof InventoryEquipmentSchema>,
): InventoryShowcaseSnapshot | undefined {
  if (!equipment.artId && equipment.essenceIds.length === 0) return undefined;
  return {
    definitionId: EQUIPMENT_ITEM.id,
    name: equipment.name,
    quantity: 1,
    instanceData: structuredClone(equipment),
  };
}
