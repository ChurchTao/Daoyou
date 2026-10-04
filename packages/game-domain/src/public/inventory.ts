/** Public inventory capabilities. Keep implementation files private. */
export {
  CONSUMABLE_TYPE_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
} from '../inventory.js';
export type {
  ConsumableType,
  EquipmentSlot,
  MaterialType,
} from '../inventory.js';
export {
  ConsumableFactsSchema,
  consumableFactsOf,
} from '../items/consumable-facts.js';
export type { ConsumableFacts } from '../items/consumable-facts.js';
export {
  FORGING_MATERIAL_TYPES,
  INVENTORY_MATERIAL_TYPES,
  MATERIAL_TYPE_NAMES,
  MaterialFactsSchema,
} from '../items/material-facts.js';
export type { MaterialFacts } from '../items/material-facts.js';
export type { ItemDefinition } from '../items/definition.js';
export {
  SeedFactsSchema,
  SeedPreviewFactsSchema,
  seedFactsOf,
} from '../items/seed-facts.js';
export {
  MAX_CRAFT_MATERIAL_QUANTITY,
  MAX_PLAYER_ITEM_QUANTITY,
} from '../items/quantity.js';
export { BAG_CAPACITY, InventoryRuleError } from '../items/bag.js';
export {
  InventoryItemStructureSchema,
  createInventorySchemas,
} from '../items/inventory.js';
export type { InventoryItem, ItemGrant } from '../items/inventory.js';
export { INVENTORY_KINDS, INVENTORY_SORT_VALUES } from '../items/sorting.js';
export type { InventorySort } from '../items/sorting.js';
export { materialFactsOf } from '../items/material.js';
