

export const EQUIPMENT_LEVELS = [
  10, 30, 50, 70, 90, 110, 130, 150, 170,
] as const;


export function isEquipmentLevel(level: number) {
  return EQUIPMENT_LEVELS.some((value) => value === level);
}


/** 保留九境界资产标识，首批只有前五境界可产出装备。 */
export const OPEN_EQUIPMENT_LEVELS = [10, 30, 50, 70, 90] as const;

export function isOpenEquipmentLevel(level: number) {
  return OPEN_EQUIPMENT_LEVELS.some((value) => value === level);
}
