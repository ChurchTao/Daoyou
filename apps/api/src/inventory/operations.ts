/** Public transaction-aware inventory operations for other application features. */
export {
  InventoryError,
  assertInventoryIdle,
  grantInventory,
  inventoryItemOf,
  mutateInventory,
  readInventory,
  saveInventoryPlan,
} from './application/InventoryService.js';
