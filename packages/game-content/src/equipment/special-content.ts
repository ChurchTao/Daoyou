import data from './data/equipment-special.json' with { type: 'json' };
import {
  compileEquipmentArt,
  compileEquipmentEssence,
  compileRageGainPassive,
} from './special-compiler.js';
import { DAO_RAGE_RESOURCE_ID } from '@daoyou/game-domain/equipment';
import { loadEquipmentSpecialPack } from '@daoyou/game-domain/equipment/authoring/special';

export {
  DAO_RAGE_RESOURCE_ID,
  DAO_EQUIPMENT_ESSENCE_ID,
  DAO_RAGE_PASSIVE_ID,
} from '@daoyou/game-domain/equipment';

const pack = loadEquipmentSpecialPack(data);
export const DAO_RAGE_RESOURCE = {
  id: DAO_RAGE_RESOURCE_ID,
  name: pack.rageResource.name,
  current: pack.rageResource.initial,
  max: pack.rageResource.maximum,
};
export const DAO_EQUIPMENT_ESSENCES_V1 = pack.essences.map(
  compileEquipmentEssence,
);
export const DAO_EQUIPMENT_ARTS_V1 = pack.arts.map(compileEquipmentArt);

export function createDaoRageGainPassive(factor: number) {
  return compileRageGainPassive(factor, pack.rageGain);
}

export function daoEquipmentEssenceOf(id: string) {
  return DAO_EQUIPMENT_ESSENCES_V1.find((definition) => definition.id === id);
}

export function daoEquipmentArtOf(id: string) {
  return DAO_EQUIPMENT_ARTS_V1.find((definition) => definition.id === id);
}
