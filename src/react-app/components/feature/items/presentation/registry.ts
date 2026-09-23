import { itemDefinition } from '@shared/inventory';
import type { ItemDefinition } from '@shared/items/types';
import {
  beastBookAdapter,
  blueprintAdapter,
  manualAdapter,
  materialAdapter,
  refinementAdapter,
  seedAdapter,
} from './basic';
import { consumableAdapter } from './consumable';
import { equipmentAdapter } from './equipment';
import { inscriptionAdapter } from './inscription';
import type { DisplayItem, ItemAdapter } from './types';

const adapters = {
  equipment: equipmentAdapter,
  consumable: consumableAdapter,
  blueprint: blueprintAdapter,
  material: materialAdapter,
  seed: seedAdapter,
  manual_jade: manualAdapter,
  inscription: inscriptionAdapter,
  beast_book: beastBookAdapter,
  beast_refinement: refinementAdapter,
} satisfies Record<ItemDefinition['kind'], ItemAdapter>;

export function resolveItemPresentation(item: DisplayItem) {
  const definition = itemDefinition(item.definitionId);
  return adapters[definition.kind](item, definition);
}
