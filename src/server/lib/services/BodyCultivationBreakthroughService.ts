import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  consumeMaterialById,
  consumeConsumableById,
} from '@server/lib/services/cultivatorService';
import {
  getBodyCultivationRealmBreakthroughCosts,
  previewBodyCultivationRealmBreakthrough,
  type BodyCultivationRealmBreakthroughCost,
} from '@shared/lib/bodyCultivation/breakthrough';
import type {
  BodyCultivationBreakthroughInventoryRequirement,
  BodyCultivationBreakthroughReadinessData,
} from '@shared/contracts/bodyCultivation';
import { canonicalizeAlchemyPropertyKey } from '@shared/lib/alchemyProperties';
import { isPillConsumable } from '@shared/lib/consumables';
import { QUALITY_ORDER } from '@shared/types/constants';
import type { Quality } from '@shared/types/constants';
import type { CompatibleAlchemyPropertyKey } from '@shared/types/consumable';
import type { Consumable, Cultivator, Material } from '@shared/types/cultivator';

export interface BodyCultivationBreakthroughCostPlan {
  requirements: BodyCultivationBreakthroughInventoryRequirement[];
  consumables: Array<{ id: string; quantity: number }>;
  materials: Array<{ id: string; quantity: number }>;
}

export interface BodyCultivationBreakthroughReadiness
  extends BodyCultivationBreakthroughReadinessData {
  costPlan: BodyCultivationBreakthroughCostPlan;
}

function getQualityOrder(quality: Quality | undefined): number {
  return quality ? (QUALITY_ORDER[quality] ?? -1) : -1;
}

function isMatchingBodyBreakthroughMaterial(
  material: Material,
  cost: Extract<BodyCultivationRealmBreakthroughCost, { type: 'material' }>,
): boolean {
  return (
    material.type === cost.materialType &&
    getQualityOrder(material.rank) >= getQualityOrder(cost.minQuality)
  );
}

function isMatchingBodyBreakthroughPill(
  consumable: Consumable,
  cost: Extract<BodyCultivationRealmBreakthroughCost, { type: 'consumable' }>,
): boolean {
  if (!isPillConsumable(consumable) || consumable.spec.family !== cost.family) {
    return false;
  }

  if (getQualityOrder(consumable.quality) < getQualityOrder(cost.minQuality)) {
    return false;
  }

  return consumable.spec.alchemyMeta.propertyVector.some(
    (property) =>
      canonicalizeAlchemyPropertyKey(
        property.key as CompatibleAlchemyPropertyKey,
      ) === cost.property && property.weight > 0,
  );
}

function planConsumableCost(
  consumables: Consumable[],
  cost: Extract<BodyCultivationRealmBreakthroughCost, { type: 'consumable' }>,
): {
  ownedQuantity: number;
  plan: Array<{ id: string; quantity: number }>;
} {
  const matches = consumables.filter((consumable) =>
    isMatchingBodyBreakthroughPill(consumable, cost),
  );
  const ownedQuantity = matches.reduce(
    (sum, consumable) => sum + Math.max(0, consumable.quantity),
    0,
  );
  let remaining = cost.quantity;
  const plan: Array<{ id: string; quantity: number }> = [];

  for (const consumable of matches) {
    if (remaining <= 0) break;
    if (!consumable.id) continue;
    const quantity = Math.min(consumable.quantity, remaining);
    if (quantity <= 0) continue;
    plan.push({ id: consumable.id, quantity });
    remaining -= quantity;
  }

  return { ownedQuantity, plan };
}

function planMaterialCost(
  materials: Material[],
  cost: Extract<BodyCultivationRealmBreakthroughCost, { type: 'material' }>,
): {
  ownedQuantity: number;
  plan: Array<{ id: string; quantity: number }>;
} {
  const matches = materials.filter((material) =>
    isMatchingBodyBreakthroughMaterial(material, cost),
  );
  const ownedQuantity = matches.reduce(
    (sum, material) => sum + Math.max(0, material.quantity),
    0,
  );
  let remaining = cost.quantity;
  const plan: Array<{ id: string; quantity: number }> = [];

  for (const material of matches) {
    if (remaining <= 0) break;
    if (!material.id) continue;
    const quantity = Math.min(material.quantity, remaining);
    if (quantity <= 0) continue;
    plan.push({ id: material.id, quantity });
    remaining -= quantity;
  }

  return { ownedQuantity, plan };
}

export function getBodyCultivationBreakthroughReadiness(
  cultivator: Cultivator,
): BodyCultivationBreakthroughReadiness {
  const preview = previewBodyCultivationRealmBreakthrough(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });
  const costs = getBodyCultivationRealmBreakthroughCosts(preview.nextRealm);
  const requirements: BodyCultivationBreakthroughInventoryRequirement[] = [];
  const consumables: BodyCultivationBreakthroughCostPlan['consumables'] = [];
  const materials: BodyCultivationBreakthroughCostPlan['materials'] = [];

  for (const cost of costs) {
    if (cost.type === 'material') {
      const planned = planMaterialCost(
        cultivator.inventory.materials ?? [],
        cost,
      );
      requirements.push({
        type: cost.type,
        name: cost.name,
        label: cost.label,
        quantity: cost.quantity,
        ownedQuantity: planned.ownedQuantity,
        met: planned.ownedQuantity >= cost.quantity,
        materialType: cost.materialType,
        minQuality: cost.minQuality,
      });
      materials.push(...planned.plan);
      continue;
    }

    const planned = planConsumableCost(cultivator.inventory.consumables ?? [], cost);
    requirements.push({
      type: cost.type,
      name: cost.name,
      label: cost.label,
      quantity: cost.quantity,
      ownedQuantity: planned.ownedQuantity,
      met: planned.ownedQuantity >= cost.quantity,
      family: cost.family,
      property: cost.property,
      minQuality: cost.minQuality,
    });
    consumables.push(...planned.plan);
  }

  const inventoryReady = requirements.every((requirement) => requirement.met);

  return {
    nextRealm: preview.nextRealm,
    canAttempt: preview.canAttempt && inventoryReady,
    successChance: preview.successChance,
    guaranteeProgress: preview.guaranteeProgress,
    failedAttempts: preview.failedAttempts,
    ruleRequirements: preview.requirements,
    inventoryRequirements: requirements,
    costPlan: {
      requirements,
      consumables,
      materials,
    },
  };
}

export async function consumeBodyCultivationBreakthroughCosts(
  userId: string,
  cultivatorId: string,
  plan: BodyCultivationBreakthroughCostPlan,
  tx: DbTransaction,
): Promise<void> {
  for (const material of plan.materials) {
    await consumeMaterialById(
      userId,
      cultivatorId,
      material.id,
      material.quantity,
      tx,
    );
  }

  for (const consumable of plan.consumables) {
    await consumeConsumableById(
      userId,
      cultivatorId,
      consumable.id,
      consumable.quantity,
      tx,
    );
  }
}
