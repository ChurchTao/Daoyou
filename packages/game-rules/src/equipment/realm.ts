import { isOpenEquipmentLevel } from '@daoyou/game-domain/equipment';
import { getLevelRealmStage, getRealmStageLevel } from '@daoyou/game-domain/progression';


/** 器阶只决定属性档位；同一大境界的道装均在初期开放。 */
export function equipmentRealm(level: number) {
  const { realm } = getLevelRealmStage(level);
  return { realm, requiredLevel: getRealmStageLevel(realm, '初期') };
}


/** 数值参考档与资产/境界标识分离：炼气20，筑基40，金丹60，元婴80，化神100。 */
export function equipmentReferenceLevel(level: number) {
  if (!isOpenEquipmentLevel(level)) throw new Error('该境界道装尚未开放');
  return level + 10;
}
