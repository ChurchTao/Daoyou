import { z } from 'zod';
import type { ForgingBoosts } from '../engine/combat-v6/equipment/forging';
import { InventoryRuleError } from '../inventory';
import type { MaterialFacts } from '../items/definitions/materials';
import { QUALITY_ORDER, type Quality } from '../types/constants';

export const ForgingLevelSchema = z
  .number()
  .int()
  .min(10)
  .max(180)
  .multipleOf(10);
export function forgingCost(level: number) {
  const t = ForgingLevelSchema.parse(level) / 10;
  const quantity = Math.ceil(t / 4);
  return {
    spiritStones: 100 * t * t,
    qi: 5 + 2 * t,
    quantity,
    rank: (['凡品', '灵品', '玄品', '真品', '地品'] as const)[quantity - 1],
  };
}
export function forgingBoosts(
  level: number,
  ownerLevel: number,
  materials: { facts: MaterialFacts; quantity: number }[],
): ForgingBoosts {
  const cost = forgingCost(level);
  if (level > ownerLevel)
    throw new InventoryRuleError('图纸等级超过人物等级，无法铸造');
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
