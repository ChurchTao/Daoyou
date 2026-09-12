import {
  getLevelRealmStage,
  getRealmStageLevel,
} from '@shared/config/realmProgression';

/** 器阶只决定属性档位；同一大境界的道装均在初期开放。 */
export function equipmentRealm(level: number) {
  const { realm } = getLevelRealmStage(level);
  return { realm, requiredLevel: getRealmStageLevel(realm, '初期') };
}

export const EQUIPMENT_LEVELS = [
  10, 30, 50, 70, 90, 110, 130, 150, 170,
] as const;

export function isEquipmentLevel(level: number) {
  return EQUIPMENT_LEVELS.some((value) => value === level);
}
