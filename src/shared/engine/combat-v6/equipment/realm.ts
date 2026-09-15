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

/** 保留九境界资产标识，首批只有前五境界可产出装备。 */
export const OPEN_EQUIPMENT_LEVELS = [10, 30, 50, 70, 90] as const;
export function isOpenEquipmentLevel(level: number) {
  return OPEN_EQUIPMENT_LEVELS.some((value) => value === level);
}

/** 数值参考档与资产/境界标识分离：炼气20，筑基40，金丹60，元婴80，化神100。 */
export function equipmentReferenceLevel(level: number) {
  if (!isOpenEquipmentLevel(level)) throw new Error('该境界道装尚未开放');
  return level + 10;
}
