import type { DaoEquipmentSlot } from './types.js';

export const DAO_WEAPON_TYPES = [
  'axe',
  'blade',
  'spear',
  'staff',
  'sword',
  'fan',
  'bell',
  'brush',
  'banner',
] as const;
export type DaoWeaponType = (typeof DAO_WEAPON_TYPES)[number];

/** 仅缺省的旧法兵回退为剑，不从器名猜测类别。调用前须通过装备校验。 */
export function daoWeaponTypeOf(equipment: {
  slot: DaoEquipmentSlot;
  weaponType?: DaoWeaponType;
}): DaoWeaponType | undefined {
  return equipment.slot === 'weapon'
    ? (equipment.weaponType ?? 'sword')
    : undefined;
}

export function equipmentWeaponTypeProblem(equipment: {
  slot: DaoEquipmentSlot;
  weaponType?: unknown;
  generatorVersion: string;
}): string | undefined {
  const { slot, weaponType, generatorVersion } = equipment;
  if (slot !== 'weapon')
    return weaponType === undefined ? undefined : '只有法兵可以指定器形';
  if (
    weaponType !== undefined &&
    (typeof weaponType !== 'string' ||
      !DAO_WEAPON_TYPES.includes(weaponType as DaoWeaponType))
  )
    return '法兵器形无效';
  if (generatorVersion === 'dao_equipment_generator_v5')
    return weaponType === undefined ? '新版法兵必须指定器形' : undefined;
  if (weaponType !== undefined && weaponType !== 'sword')
    return '旧版法兵仅兼容剑';
}
