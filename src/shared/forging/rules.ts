import {
  equipmentRealm,
  isEquipmentLevel,
} from '@shared/engine/combat-v6/equipment/realm';
import { z } from 'zod';
import type { ForgingBoosts } from '../engine/combat-v6/equipment/forging';
import { DAO_EQUIPMENT_FORGING } from '../engine/combat-v6/equipment/forging-content';
import { InventoryRuleError } from '../inventory';
import type { MaterialFacts } from '../items/definitions/materials';
import { QUALITY_ORDER, type Quality } from '../types/constants';

export const ForgingLevelSchema = z
  .number()
  .int()
  .min(10)
  .max(170)
  .multipleOf(10)
  .refine(isEquipmentLevel, '道装必须属于九个境界档位');
export function forgingCost(level: number) {
  const validLevel = ForgingLevelSchema.parse(level);
  const cost = DAO_EQUIPMENT_FORGING.costs.find(
    (entry) => entry.level === validLevel,
  )!;
  return {
    spiritStones: cost.spiritStones,
    qi: cost.qi,
    quantity: cost.quantity,
    rank: cost.rank,
  };
}
export function forgingBoosts(
  level: number,
  ownerLevel: number,
  materials: { facts: MaterialFacts; quantity: number }[],
): ForgingBoosts {
  const cost = forgingCost(level);
  if (equipmentRealm(level).requiredLevel > ownerLevel)
    throw new InventoryRuleError('图纸境界超过人物境界，无法铸造');
  if (
    materials.some((m) => !Number.isInteger(m.quantity) || m.quantity < 1) ||
    materials.reduce((n, m) => n + m.quantity, 0) !== cost.quantity
  )
    throw new InventoryRuleError(`需要恰好 ${cost.quantity} 件材料`);
  const boosts: ForgingBoosts = { ore: 0, essence: 0, attributes: 0 };
  for (const { facts, quantity } of materials) {
    if (
      !(facts.rank in QUALITY_ORDER) ||
      QUALITY_ORDER[facts.rank as Quality] < QUALITY_ORDER[cost.rank]
    )
      throw new InventoryRuleError(`材料最低品质为${cost.rank}`);
    if (facts.type === 'ore') boosts.ore += quantity;
    else if (facts.type === 'tcdb') boosts.essence += quantity;
    else if (facts.type === 'aux' || facts.type === 'monster')
      boosts.attributes += quantity;
    else throw new InventoryRuleError('该材料不能用于铸造');
  }
  return boosts;
}
