import { BOOKS } from './definitions/beast-books';
import { EQUIPMENT_ITEM } from './definitions/equipment';
import { BLUEPRINTS } from './definitions/equipment-blueprints';
import { MATERIAL_ITEM } from './definitions/materials';
import type { ItemDefinition } from './types';
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  ...BOOKS,
  ...BLUEPRINTS,
  EQUIPMENT_ITEM,
  MATERIAL_ITEM,
];
const definitions = new Map(ITEM_DEFINITIONS.map((item) => [item.id, item]));
export function findItemDefinition(id: string) {
  return definitions.get(id);
}
