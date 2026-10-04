import { createInventoryEquipmentSchema } from '@daoyou/game-domain/equipment';
import { createInventorySchemas } from '@daoyou/game-domain/inventory';
import { createSectDeliveryRequirementSchemas } from '@daoyou/game-domain/sects/tasks';
import { createResourceSchemas } from './registry.js';

// Protocol fixtures: these tests exercise envelopes, scopes and reducers.
// Content-bound inventory validation is covered by the owning game-rules tests.
const { ItemGrantSchema } = createInventorySchemas({
  findItemDefinition: () => undefined,
  InventoryEquipmentSchema: createInventoryEquipmentSchema(() => []),
});
const { SectDeliveryRequirementSchema } = createSectDeliveryRequirementSchemas({
  pill: 1,
  equipment: 1,
  material: { min: 1, max: 3 },
});
export const { RESOURCE_DATA_SCHEMAS, ResourceChangeSchema } =
  createResourceSchemas({ ItemGrantSchema, SectDeliveryRequirementSchema });
