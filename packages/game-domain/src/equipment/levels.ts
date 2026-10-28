

export const EQUIPMENT_LEVELS = [
  10, 30, 50, 70, 90, 110, 130, 150, 170,
] as const;


export function isEquipmentLevel(level: number) {
  return EQUIPMENT_LEVELS.some((value) => value === level);
}


/** 当前可铸造的器阶。图纸掉落另见 blueprintRealmWeights，不要用这张表裁掉落。 */
export const OPEN_EQUIPMENT_LEVELS = EQUIPMENT_LEVELS;

export function isOpenEquipmentLevel(level: number) {
  return OPEN_EQUIPMENT_LEVELS.some((value) => value === level);
}
