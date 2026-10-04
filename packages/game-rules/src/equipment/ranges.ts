import { DAO_EQUIPMENT_BASE_GENERATION } from '@daoyou/game-content/equipment/base';
import { DAO_WEAPONS } from '@daoyou/game-content/equipment/weapons';
import type {
  DaoEquipmentTemplateV1,
  DaoWeaponType,
} from '@daoyou/game-domain/equipment';


export function daoEquipmentAttributeRange(equipmentLevel: number): {
  min: number;
  max: number;
} {
  const range = DAO_EQUIPMENT_BASE_GENERATION.bonusRanges.find((r) => r.level === equipmentLevel);
  if (!range) throw new Error('该境界道装尚未开放');
  return { min: range.min, max: range.max };
}


/** 品阶进度为0～1；全部材料平均超出门槛两阶时封顶。 */
export function daoEquipmentBaseRange(
  stat: DaoEquipmentTemplateV1['baseStats'][number],
  equipmentLevel: number,
  baseQuality = 0,
  weaponType?: DaoWeaponType,
): { min: number; max: number } {
  const range = stat.ranges.find((r) => r.level === equipmentLevel);
  if (!range) throw new Error('该境界道装尚未开放');
  const factor = weaponType && (stat.attr === 'physicalAtk' || stat.attr === 'magicAtk')
    ? DAO_WEAPONS[weaponType][stat.attr]
    : 1;
  // 先保留原材料品阶插值，再调整器形区间；生成、择优与校验共用取整顺序。
  const min = Math.round(range.normal[0] + baseQuality * (range.enhanced[0] - range.normal[0]));
  const max = Math.round(range.normal[1] + baseQuality * (range.enhanced[1] - range.normal[1]));
  return {
    min: Math.round(min * factor),
    max: Math.round(max * factor),
  };
}
