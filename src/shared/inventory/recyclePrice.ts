import { DAO_EQUIPMENT_FORGING } from '../engine/combat-v6/equipment/forging-content';
import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '../engine/material/creation/config';
import { QUALITY_VALUES, REALM_VALUES, type Quality } from '../types/constants';

export function seedRecycleUnitPrice(quality: Quality): number {
  return Math.max(1, Math.floor(BASE_PRICES[quality] * 0.3));
}

export function manualJadeRecycleUnitPrice(manualId: string): number {
  const manual = CHARACTER_MANUALS_V1.find((entry) => entry.id === manualId);
  if (!manual) throw new Error('功法玉简定义无效');
  const realmIndex = REALM_VALUES.indexOf(manual.realm);
  const quality =
    QUALITY_VALUES[Math.min(realmIndex, QUALITY_VALUES.length - 1)];
  return Math.max(
    1,
    Math.floor(BASE_PRICES[quality] * TYPE_MULTIPLIERS.gongfa_manual * 0.3),
  );
}

export function blueprintRecycleUnitPrice(level: number): number {
  const cost = DAO_EQUIPMENT_FORGING.costs.find(
    (entry) => entry.level === level,
  );
  if (!cost) throw new Error('道装图纸境界无效');
  return Math.max(1, Math.floor(cost.spiritStones * 0.2));
}

export function equipmentRecycleUnitPrice(equipment: {
  equipmentLevel: number;
  baseQuality: number;
}): number {
  const cost = DAO_EQUIPMENT_FORGING.costs.find(
    (entry) => entry.level === equipment.equipmentLevel,
  );
  if (!cost) throw new Error('道装境界无效');
  return Math.max(
    1,
    Math.floor(cost.spiritStones * (0.5 + equipment.baseQuality * 0.25)),
  );
}
