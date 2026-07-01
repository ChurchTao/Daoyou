import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import {
  consumeMaterialById,
  consumeConsumableById,
} from '@server/lib/services/cultivatorService';
import {
  previewBodyCultivationRealmBreakthrough,
  type BodyCultivationRealmBreakthroughCost,
} from '@shared/lib/bodyCultivation/breakthrough';
import type {
  BodyCultivationBreakthroughCostRequirement,
  BodyCultivationBreakthroughInventoryRequirement,
  BodyCultivationBreakthroughRequest,
  BodyCultivationBreakthroughReadinessData,
} from '@shared/contracts/bodyCultivation';
import { canonicalizeAlchemyPropertyKey } from '@shared/lib/alchemyProperties';
import { isPillConsumable } from '@shared/lib/consumables';
import { QUALITY_ORDER } from '@shared/types/constants';
import type { Quality } from '@shared/types/constants';
import type { CompatibleAlchemyPropertyKey } from '@shared/types/consumable';
import type { Consumable, Cultivator, Material } from '@shared/types/cultivator';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { mapConsumableRow } from './consumablePersistence';

export interface BodyCultivationBreakthroughCostPlan {
  requirements: BodyCultivationBreakthroughInventoryRequirement[];
  consumables: Array<{ id: string; quantity: number }>;
  materials: Array<{ id: string; quantity: number }>;
}

function getQualityOrder(quality: Quality | undefined): number {
  return quality ? (QUALITY_ORDER[quality] ?? -1) : -1;
}

function getEligibleQualities(minQuality: Quality): Quality[] {
  const minOrder = getQualityOrder(minQuality);
  return (Object.keys(QUALITY_ORDER) as Quality[]).filter(
    (quality) => getQualityOrder(quality) >= minOrder,
  );
}

function toCostRequirement(
  cost: BodyCultivationRealmBreakthroughCost,
): BodyCultivationBreakthroughCostRequirement {
  if (cost.type === 'material') {
    return {
      type: cost.type,
      name: cost.name,
      label: cost.label,
      quantity: cost.quantity,
      materialType: cost.materialType,
      minQuality: cost.minQuality,
    };
  }

  return {
    type: cost.type,
    name: cost.name,
    label: cost.label,
    quantity: cost.quantity,
    family: cost.family,
    property: cost.property,
    minQuality: cost.minQuality,
  };
}

function getCostKey(cost: BodyCultivationRealmBreakthroughCost): string {
  if (cost.type === 'material') {
    return `${cost.type}:${cost.materialType}:${cost.minQuality}`;
  }

  return `${cost.type}:${cost.family}:${cost.property}:${cost.minQuality}`;
}

function toMaterial(row: typeof schema.materials.$inferSelect): Material {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Material['type'],
    rank: row.rank as Quality,
    quantity: row.quantity,
    description: row.description ?? '',
    element: row.element as Material['element'],
    details: row.details as Material['details'],
  };
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

  const propertyVector = consumable.spec.alchemyMeta?.propertyVector;
  if (!Array.isArray(propertyVector)) {
    return false;
  }

  return propertyVector.some((property) => {
    const key = (property as { key?: unknown }).key;
    const weight = (property as { weight?: unknown }).weight;
    if (typeof key !== 'string' || typeof weight !== 'number') {
      return false;
    }

    return (
      canonicalizeAlchemyPropertyKey(
        key as CompatibleAlchemyPropertyKey,
      ) === cost.property && weight > 0
    );
  });
}

export function getBodyCultivationBreakthroughPreviewData(
  cultivator: Cultivator,
): BodyCultivationBreakthroughReadinessData {
  const preview = previewBodyCultivationRealmBreakthrough(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });

  return {
    nextRealm: preview.nextRealm,
    canAttempt: preview.canAttempt,
    successChance: preview.successChance,
    guaranteeProgress: preview.guaranteeProgress,
    failedAttempts: preview.failedAttempts,
    ruleRequirements: preview.requirements,
    costRequirements: preview.costs.map(toCostRequirement),
  };
}

async function getCandidateMaterialsByIds(
  cultivator: Cultivator,
  ids: string[],
  q: DbExecutor | DbTransaction,
): Promise<Material[]> {
  const inventoryMatches = cultivator.inventory.materials?.filter(
    (material) => material.id && ids.includes(material.id),
  );
  if (inventoryMatches?.length) {
    return inventoryMatches;
  }
  if (ids.length === 0) return [];

  const rows = await q
    .select()
    .from(schema.materials)
    .where(
      and(
        eq(schema.materials.cultivatorId, cultivator.id!),
        inArray(schema.materials.id, ids),
      ),
    );

  return rows.map(toMaterial);
}

async function getCandidateConsumablesByIds(
  cultivator: Cultivator,
  ids: string[],
  q: DbExecutor | DbTransaction,
): Promise<Consumable[]> {
  const inventoryMatches = cultivator.inventory.consumables?.filter(
    (consumable) => consumable.id && ids.includes(consumable.id),
  );
  if (inventoryMatches?.length) {
    return inventoryMatches;
  }
  if (ids.length === 0) return [];

  const rows = await q
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivator.id!),
        inArray(schema.consumables.id, ids),
      ),
    );

  return rows.map(mapConsumableRow);
}

function normalizeSelections(
  selections: BodyCultivationBreakthroughRequest['materialSelections'],
): Array<{ id: string; quantity: number }> {
  const selectionMap = new Map<string, number>();

  for (const selection of selections) {
    const id = selection.id.trim();
    const quantity = Math.floor(selection.quantity);
    if (!id || quantity <= 0) {
      throw new Error('突破材料选择不完整。');
    }
    selectionMap.set(id, (selectionMap.get(id) ?? 0) + quantity);
  }

  return [...selectionMap.entries()].map(([id, quantity]) => ({
    id,
    quantity,
  }));
}

function assignSelectionToCost(args: {
  itemName: string;
  quantity: number;
  matchingCosts: BodyCultivationRealmBreakthroughCost[];
  totalsByCostKey: Map<string, number>;
}): void {
  const targetCost = args.matchingCosts.find((cost) => {
    const current = args.totalsByCostKey.get(getCostKey(cost)) ?? 0;
    return current + args.quantity <= cost.quantity;
  });

  if (!targetCost) {
    throw new Error(
      args.matchingCosts.length > 0
        ? `${args.itemName} 的选择数量超过突破所需。`
        : `${args.itemName} 不符合本次肉身破限要求。`,
    );
  }

  const key = getCostKey(targetCost);
  args.totalsByCostKey.set(
    key,
    (args.totalsByCostKey.get(key) ?? 0) + args.quantity,
  );
}

export async function listEligibleBodyCultivationBreakthroughItems(
  cultivator: Cultivator,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<{
  requirements: BodyCultivationBreakthroughCostRequirement[];
  materials: Array<Material & { requirementLabel: string }>;
  consumables: Array<Consumable & { requirementLabel: string }>;
}> {
  const preview = previewBodyCultivationRealmBreakthrough(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });
  const materialCosts = preview.costs.filter(
    (
      cost,
    ): cost is Extract<
      BodyCultivationRealmBreakthroughCost,
      { type: 'material' }
    > => cost.type === 'material',
  );
  const consumableCosts = preview.costs.filter(
    (
      cost,
    ): cost is Extract<
      BodyCultivationRealmBreakthroughCost,
      { type: 'consumable' }
    > => cost.type === 'consumable',
  );

  let materialCandidates = cultivator.inventory.materials ?? [];
  if (materialCandidates.length === 0 && materialCosts.length > 0) {
    const materialTypes = [
      ...new Set(materialCosts.map((cost) => cost.materialType)),
    ];
    const qualities = [
      ...new Set(
        materialCosts.flatMap((cost) => getEligibleQualities(cost.minQuality)),
      ),
    ];
    const rows = await q
      .select()
      .from(schema.materials)
      .where(
        and(
          eq(schema.materials.cultivatorId, cultivator.id!),
          inArray(schema.materials.type, materialTypes),
          inArray(schema.materials.rank, qualities),
          sql`${schema.materials.quantity} > 0`,
        ),
      );
    materialCandidates = rows.map(toMaterial);
  }

  let consumableCandidates = cultivator.inventory.consumables ?? [];
  if (consumableCandidates.length === 0 && consumableCosts.length > 0) {
    const qualities = [
      ...new Set(
        consumableCosts.flatMap((cost) => getEligibleQualities(cost.minQuality)),
      ),
    ];
    const rows = await q
      .select()
      .from(schema.consumables)
      .where(
        and(
          eq(schema.consumables.cultivatorId, cultivator.id!),
          eq(schema.consumables.type, '丹药'),
          sql`${schema.consumables.quantity} > 0`,
          sql`${schema.consumables.spec} ->> 'kind' = 'pill'`,
          sql`${schema.consumables.spec} ->> 'family' = 'tempering'`,
          inArray(schema.consumables.quality, qualities),
        ),
      );
    consumableCandidates = rows.map(mapConsumableRow);
  }

  return {
    requirements: preview.costs.map(toCostRequirement),
    materials: materialCandidates.flatMap((material) => {
      const matchedCost = materialCosts.find((cost) =>
        isMatchingBodyBreakthroughMaterial(material, cost),
      );
      return matchedCost && material.id
        ? [{ ...material, requirementLabel: matchedCost.label }]
        : [];
    }),
    consumables: consumableCandidates.flatMap((consumable) => {
      const matchedCost = consumableCosts.find((cost) =>
        isMatchingBodyBreakthroughPill(consumable, cost),
      );
      return matchedCost && consumable.id
        ? [{ ...consumable, requirementLabel: matchedCost.label }]
        : [];
    }),
  };
}

export async function planBodyCultivationBreakthroughSelections(
  cultivator: Cultivator,
  request: BodyCultivationBreakthroughRequest,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<BodyCultivationBreakthroughCostPlan> {
  const preview = previewBodyCultivationRealmBreakthrough(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });
  if (!preview.nextRealm) {
    throw new Error('肉身已达最高阶位。');
  }
  if (!preview.canAttempt) {
    const missing = preview.requirements
      .filter((requirement) => !requirement.met)
      .map((requirement) => requirement.label)
      .join('、');
    throw new Error(`肉身进阶条件不足：${missing || '基础条件不足'}`);
  }

  const materialCosts = preview.costs.filter(
    (
      cost,
    ): cost is Extract<
      BodyCultivationRealmBreakthroughCost,
      { type: 'material' }
    > => cost.type === 'material',
  );
  const consumableCosts = preview.costs.filter(
    (
      cost,
    ): cost is Extract<
      BodyCultivationRealmBreakthroughCost,
      { type: 'consumable' }
    > => cost.type === 'consumable',
  );
  const materialSelections = normalizeSelections(request.materialSelections);
  const consumableSelections = normalizeSelections(request.consumableSelections);
  const selectedMaterials = await getCandidateMaterialsByIds(
    cultivator,
    materialSelections.map((selection) => selection.id),
    q,
  );
  const selectedConsumables = await getCandidateConsumablesByIds(
    cultivator,
    consumableSelections.map((selection) => selection.id),
    q,
  );
  const materialsById = new Map(
    selectedMaterials.flatMap((material) =>
      material.id ? [[material.id, material] as const] : [],
    ),
  );
  const consumablesById = new Map(
    selectedConsumables.flatMap((consumable) =>
      consumable.id ? [[consumable.id, consumable] as const] : [],
    ),
  );
  const totalsByCostKey = new Map<string, number>();
  const materialPlan: BodyCultivationBreakthroughCostPlan['materials'] = [];
  const consumablePlan: BodyCultivationBreakthroughCostPlan['consumables'] = [];

  for (const selection of materialSelections) {
    const material = materialsById.get(selection.id);
    if (!material) {
      throw new Error('所选材料不存在或不属于当前角色。');
    }
    if (selection.quantity > material.quantity) {
      throw new Error(`${material.name} 数量不足。`);
    }
    assignSelectionToCost({
      itemName: material.name,
      quantity: selection.quantity,
      matchingCosts: materialCosts.filter((cost) =>
        isMatchingBodyBreakthroughMaterial(material, cost),
      ),
      totalsByCostKey,
    });
    materialPlan.push({ id: selection.id, quantity: selection.quantity });
  }

  for (const selection of consumableSelections) {
    const consumable = consumablesById.get(selection.id);
    if (!consumable) {
      throw new Error('所选丹药不存在或不属于当前角色。');
    }
    if (selection.quantity > consumable.quantity) {
      throw new Error(`${consumable.name} 数量不足。`);
    }
    assignSelectionToCost({
      itemName: consumable.name,
      quantity: selection.quantity,
      matchingCosts: consumableCosts.filter((cost) =>
        isMatchingBodyBreakthroughPill(consumable, cost),
      ),
      totalsByCostKey,
    });
    consumablePlan.push({ id: selection.id, quantity: selection.quantity });
  }

  const requirements = preview.costs.map((cost) => {
    const selectedQuantity = totalsByCostKey.get(getCostKey(cost)) ?? 0;
    return {
      ...toCostRequirement(cost),
      ownedQuantity: selectedQuantity,
      met: selectedQuantity === cost.quantity,
    };
  });

  for (const cost of preview.costs) {
    const selectedQuantity = totalsByCostKey.get(getCostKey(cost)) ?? 0;
    if (selectedQuantity !== cost.quantity) {
      throw new Error(
        `${cost.label} ${selectedQuantity}/${cost.quantity}，请重新选择。`,
      );
    }
  }

  return {
    requirements,
    materials: materialPlan,
    consumables: consumablePlan,
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
