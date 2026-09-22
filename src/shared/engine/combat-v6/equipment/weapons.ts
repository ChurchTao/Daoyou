import type { DaoEquipmentSlot } from './types';

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

/** 相对标准剑的器胚区间系数；不作用于人物总面板或治疗属性。 */
export const DAO_WEAPONS = {
  axe: { name: '斧', physicalAtk: 1.15, magicAtk: 0.85 },
  blade: { name: '刀', physicalAtk: 1.12, magicAtk: 0.88 },
  spear: { name: '枪', physicalAtk: 1.09, magicAtk: 0.91 },
  staff: { name: '棍', physicalAtk: 1.03, magicAtk: 0.97 },
  sword: { name: '剑', physicalAtk: 1.0, magicAtk: 1.0 },
  fan: { name: '扇', physicalAtk: 0.94, magicAtk: 1.06 },
  bell: { name: '铃', physicalAtk: 0.91, magicAtk: 1.09 },
  brush: { name: '笔', physicalAtk: 0.88, magicAtk: 1.12 },
  banner: { name: '幡', physicalAtk: 0.85, magicAtk: 1.15 },
} as const satisfies Record<
  DaoWeaponType,
  {
    name: string;
    physicalAtk: number;
    magicAtk: number;
  }
>;

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
