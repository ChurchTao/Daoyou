import {
  createWildStateSchemas,
  createWildEncounterSchema,
} from '@daoyou/game-domain/wild';
import { ItemGrantSchema } from '../../inventory/index.js';
import { BeastSchema } from '../../beasts/schema.js';
import { WildIndividualSchema } from './generator.js';
export const { WildRuntimeSchema, WildSettlementSchema } = createWildStateSchemas({ ItemGrantSchema, BeastSchema, WildIndividualSchema });
export const WildEncounterSchema = createWildEncounterSchema(WildIndividualSchema);
