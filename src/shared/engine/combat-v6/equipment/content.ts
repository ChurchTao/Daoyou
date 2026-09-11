import data from './data/equipment-base.json';
import { loadEquipmentBasePack } from './pack';
import type {
  DaoEquipmentTemplateV1,
  DaoFormationInscriptionDefV1,
} from './types.ts';

export const DAO_EQUIPMENT_TEMPLATE_ID = {
  Weapon: 'dao_equipment.standard.weapon.v1',
  Head: 'dao_equipment.standard.head.v1',
  Armor: 'dao_equipment.standard.armor.v1',
  Necklace: 'dao_equipment.standard.necklace.v1',
  Belt: 'dao_equipment.standard.belt.v1',
  Footwear: 'dao_equipment.standard.footwear.v1',
} as const;

const pack = loadEquipmentBasePack(data);
export const DAO_EQUIPMENT_TEMPLATES_V1: readonly DaoEquipmentTemplateV1[] =
  pack.templates;
export const DAO_EQUIPMENT_BASE_GENERATION = pack.generation;

export function daoEquipmentAttributeRange(equipmentLevel: number): {
  min: number;
  max: number;
} {
  const { minCoefficient, maxCoefficient } =
    DAO_EQUIPMENT_BASE_GENERATION.bonusValue;
  return {
    min: Math.max(1, Math.floor(equipmentLevel * minCoefficient)),
    max: Math.max(1, Math.floor(equipmentLevel * maxCoefficient)),
  };
}

export const DAO_FORMATION_INSCRIPTION_ID = {
  Xuanfeng: 'dao_inscription.xuanfeng',
  Lingyao: 'dao_inscription.lingyao',
  Jingang: 'dao_inscription.jingang',
  Xuanjia: 'dao_inscription.xuanjia',
  Changsheng: 'dao_inscription.changsheng',
  Canghai: 'dao_inscription.canghai',
  Jifeng: 'dao_inscription.jifeng',
  Dongming: 'dao_inscription.dongming',
  Liuyun: 'dao_inscription.liuyun',
} as const;

export const DAO_FORMATION_INSCRIPTIONS_V1: readonly DaoFormationInscriptionDefV1[] =
  pack.inscriptions;

export function daoEquipmentTemplateOf(
  id: string,
): DaoEquipmentTemplateV1 | undefined {
  return DAO_EQUIPMENT_TEMPLATES_V1.find((template) => template.id === id);
}

export function daoFormationInscriptionOf(
  id: string,
): DaoFormationInscriptionDefV1 | undefined {
  return DAO_FORMATION_INSCRIPTIONS_V1.find((pattern) => pattern.id === id);
}
