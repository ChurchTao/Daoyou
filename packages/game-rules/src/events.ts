import { createDomainEventDataSchemas } from '@daoyou/game-domain/events';
import { ItemGrantSchema } from './inventory/index.js';
import { InventoryEquipmentSchema } from './inventory/equipment.js';
import { BeastTradePreviewSchema } from './beasts/trade.js';

export const DomainEventDataSchemas = createDomainEventDataSchemas({
  ItemGrantSchema,
  InventoryEquipmentSchema,
  BeastTradePreviewSchema,
});
