import {
  ForgingLevelSchema,
  isOpenEquipmentLevel,
  equipmentWeaponTypeProblem,
  type DaoWeaponType,
} from '@daoyou/game-domain/equipment';

import { equipmentRealm } from '../equipment/realm.js';

import type { ForgingBoosts } from '../equipment/forging.js';

import { DAO_EQUIPMENT_FORGING } from '@daoyou/game-content/equipment/forging';

import type { DaoEquipmentSlot } from '@daoyou/game-domain/equipment';


import { InventoryRuleError } from '@daoyou/game-domain/inventory';

import type { MaterialFacts } from '@daoyou/game-domain/inventory';

import { QUALITY_ORDER, type Quality } from '@daoyou/constants/qualities';

/** 部位来自服务端实际图纸；不得信任客户端自行声明的部位。 */
export function validateForgeWeaponType(
  slot: DaoEquipmentSlot,
  weaponType?: DaoWeaponType,
) {
  const problem = equipmentWeaponTypeProblem({
    slot,
    weaponType,
    generatorVersion: 'dao_equipment_generator_v5',
  });
  if (problem) throw new InventoryRuleError(problem);
}

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
  if (!isOpenEquipmentLevel(level))
    throw new InventoryRuleError('道装打造仅开放至化神期');
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

/** 输入均来自服务端库存事实，前端仅复用此规则做确认预览。 */
export function forgingInputs(
  level: number,
  ownerLevel: number,
  materials: { facts: MaterialFacts; quantity: number }[],
) {
  const boosts = forgingBoosts(level, ownerLevel, materials);
  const cost = forgingCost(level);
  const excess = materials.reduce(
    (sum, material) =>
      sum +
      material.quantity *
        (QUALITY_ORDER[material.facts.rank] - QUALITY_ORDER[cost.rank]),
    0,
  );
  return { boosts, baseQuality: Math.min(1, excess / (cost.quantity * 2)) };
}
