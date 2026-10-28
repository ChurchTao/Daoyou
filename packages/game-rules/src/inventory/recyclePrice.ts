import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import { DAO_EQUIPMENT_FORGING } from '@daoyou/game-content/equipment/forging';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { BASE_PRICES } from '@daoyou/game-content/materials';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import { type Quality } from '@daoyou/constants/qualities';

const BOOK_RECYCLE_PRICES = [5_000, 15_000, 50_000, 150_000, 300_000] as const;

/** 元婴起与历练时基冻结在 187.5 倍。炼气到金丹仍用原表，不随历练基数重算。 */
const BLUEPRINT_RECYCLE_PRICES: Record<RealmType, number> = {
  炼气: 5_000,
  筑基: 15_000,
  金丹: 50_000,
  元婴: 150_000,
  化神: 300_000,
  炼虚: 600_000,
  合体: 900_000,
  大乘: 1_200_000,
  渡劫: 2_400_000,
};

function bookRecycleUnitPrice(realm: RealmType): number {
  const index = REALM_VALUES.indexOf(realm);
  return BOOK_RECYCLE_PRICES[Math.min(index, BOOK_RECYCLE_PRICES.length - 1)];
}

export function seedRecycleUnitPrice(quality: Quality): number {
  return Math.max(1, Math.floor(BASE_PRICES[quality] * 0.3));
}

export function manualJadeRecycleUnitPrice(manualId: string): number {
  const manual = CHARACTER_MANUALS_V1.find((entry) => entry.id === manualId);
  if (!manual) throw new Error('功法玉简定义无效');
  return bookRecycleUnitPrice(manual.realm);
}

export function blueprintRecycleUnitPrice(level: number): number {
  const cost = DAO_EQUIPMENT_FORGING.costs.find(
    (entry) => entry.level === level,
  );
  if (!cost) throw new Error('道装图纸境界无效');
  return BLUEPRINT_RECYCLE_PRICES[getLevelRealmStage(level).realm];
}

export function equipmentRecycleUnitPrice(equipment: {
  equipmentLevel: number;
}): number {
  const cost = DAO_EQUIPMENT_FORGING.costs.find(
    (entry) => entry.level === equipment.equipmentLevel,
  );
  if (!cost) throw new Error('道装境界无效');
  return Math.max(
    1,
    Math.floor(
      (blueprintRecycleUnitPrice(equipment.equipmentLevel) +
        cost.spiritStones) *
        0.7,
    ),
  );
}
