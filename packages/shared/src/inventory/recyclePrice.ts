import { getLevelRealmStage } from '../config/realmProgression.js';
import { DAO_EQUIPMENT_FORGING } from '../engine/combat-v6/equipment/forging-content.js';
import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content.js';
import { BASE_PRICES } from '../engine/material/creation/config.js';
import { REALM_VALUES, type Quality, type RealmType } from '../types/constants.js';

const BOOK_RECYCLE_PRICES = [5_000, 15_000, 50_000, 150_000, 300_000] as const;

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
  return bookRecycleUnitPrice(getLevelRealmStage(level).realm);
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
