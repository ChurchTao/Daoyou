/** Public inventory capabilities. Keep implementation files private. */
export {
  InventoryItemSchema,
  ItemGrantSchema,
  addItems,
  emptySlot,
  itemDefinition,
  learnBeastSkill,
  sameStack,
  sortBag,
} from '../inventory/index.js';
export { changeEquipmentLocation } from '../inventory/equipment-location.js';
export { sortInventoryItems } from '../inventory/sorting.js';
