import { BEAST_REFINEMENT } from '../engine/combat-v6/beasts/refinement-config.js';
import { BOOKS } from './definitions/beast-books.js';
import { BEAST_REJUVENATION } from './definitions/beast-rejuvenation.js';
import { CONSUMABLE_ITEM } from './definitions/consumables.js';
import { EQUIPMENT_ITEM } from './definitions/equipment.js';
import { BLUEPRINTS } from './definitions/equipment-blueprints.js';
import { MANUAL_JADES } from './definitions/manual-jades.js';
import { MATERIAL_ITEM } from './definitions/materials.js';
import { INSCRIPTION_ITEMS } from './definitions/inscriptions.js';
import { SEED_ITEM } from './definitions/seeds.js';
import type { ItemDefinition } from './types.js';
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  ...BOOKS,
  ...BEAST_REFINEMENT.items.map((item) => ({
    ...item,
    kind: 'beast_refinement' as const,
  })),
  BEAST_REJUVENATION,
  ...BLUEPRINTS,
  EQUIPMENT_ITEM,
  MATERIAL_ITEM,
  SEED_ITEM,
  CONSUMABLE_ITEM,
  ...MANUAL_JADES,
  ...INSCRIPTION_ITEMS,
];
const definitions = new Map(ITEM_DEFINITIONS.map((item) => [item.id, item]));
export function findItemDefinition(id: string) {
  return definitions.get(id);
}
