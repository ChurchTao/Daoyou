

export const EQUIPMENT_LEVELS = [
  10, 30, 50, 70, 90, 110, 130, 150, 170,
] as const;


export function isEquipmentLevel(level: number) {
  return EQUIPMENT_LEVELS.some((value) => value === level);
}


/** 炼气至化神可以铸造。更高器阶的图纸按历练、副本和蜃楼规则掉落，铸造仍拒绝。 */
export const OPEN_EQUIPMENT_LEVELS = [10, 30, 50, 70, 90] as const;

export function isOpenEquipmentLevel(level: number) {
  return OPEN_EQUIPMENT_LEVELS.some((value) => value === level);
}
