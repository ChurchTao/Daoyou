import { BEAST_REFINEMENT } from '../beasts/refinement-config.js';
import { BOOKS } from './beast-books.js';
import { BEAST_REJUVENATION } from './beast-rejuvenation.js';
import { CONSUMABLE_ITEM } from './consumables.js';
import { EQUIPMENT_ITEM } from './equipment.js';
import { BLUEPRINTS } from './equipment-blueprints.js';
import { MANUAL_JADES } from './manual-jades.js';
import { MATERIAL_ITEM } from './materials.js';
import { INSCRIPTION_ITEMS } from './inscriptions.js';
import { SEED_ITEM } from './seeds.js';
import type { ItemDefinition } from '@daoyou/game-domain/inventory';
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
