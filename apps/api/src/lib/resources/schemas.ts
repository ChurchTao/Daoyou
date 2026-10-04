import { createResourceSchemas } from '@daoyou/contracts/resources';
import { ItemGrantSchema } from '@daoyou/game-rules/inventory';
import { SectDeliveryRequirementSchema } from '@daoyou/game-rules/sect-organization/tasks';

export const { RESOURCE_DATA_SCHEMAS, ResourceChangeSchema } =
  createResourceSchemas({ ItemGrantSchema, SectDeliveryRequirementSchema });
