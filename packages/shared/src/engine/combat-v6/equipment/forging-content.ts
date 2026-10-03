import data from './data/equipment-forging.json' with { type: 'json' };
import { loadEquipmentForgingPack } from './forging-pack.js';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from './special-content.js';
import type { DaoEquipmentSlot } from './types.js';

const pack = loadEquipmentForgingPack(data, {
  essences: DAO_EQUIPMENT_ESSENCES_V1,
  arts: DAO_EQUIPMENT_ARTS_V1,
});
export const DAO_EQUIPMENT_SPECIAL_GENERATION = pack.generation;
export const DAO_EQUIPMENT_FORGING = pack.forging;

export function equipmentEssencePool(slot: DaoEquipmentSlot) {
  return pack.generation.essencePool.filter((id) => {
    const definition = DAO_EQUIPMENT_ESSENCES_V1.find(
      (entry) => entry.id === id,
    )!;
    return !definition.allowedSlots || definition.allowedSlots.includes(slot);
  });
}

export function equipmentArtPool(slot: DaoEquipmentSlot) {
  return pack.generation.artPool.filter((id) => {
    const definition = DAO_EQUIPMENT_ARTS_V1.find((entry) => entry.id === id)!;
    return !definition.allowedSlots || definition.allowedSlots.includes(slot);
  });
}
