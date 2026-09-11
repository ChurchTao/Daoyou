import data from './data/equipment-special.json';
import {
  compileEquipmentArt,
  compileEquipmentEssence,
  compileRageGainPassive,
} from './special-compiler';
import { DAO_RAGE_RESOURCE_ID } from './special-ids';
import { loadEquipmentSpecialPack } from './special-pack';

export * from './special-ids';

const pack = loadEquipmentSpecialPack(data);
export const DAO_EQUIPMENT_MULTI_SECT_DOWNED_SKILL_IDS = pack.arts
  .filter((art) => art.includeDownedInMultiSect)
  .map((art) => art.skillId);
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
