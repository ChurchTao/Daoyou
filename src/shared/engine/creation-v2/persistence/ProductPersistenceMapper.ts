import type { CreationProductInsert } from '@server/lib/repositories/creationProductRepository';
import type {
  ArtifactProductModel,
  CreationProductModel,
} from '../models/types';
import type { CraftedOutcome } from '../types';
import type { ElementType } from '@shared/types/constants';
import { extractElement } from './elementExtractor';
import { rehydrateProductModel } from './ProductRehydrator';
import { calculateProductScore } from './ScoreCalculator';

export type ProductRow = Omit<CreationProductInsert, 'id'>;

export function toRow(
  outcome: CraftedOutcome,
  cultivatorId: string,
): ProductRow {
  const model = outcome.blueprint.productModel;
  const abilityTags = getAbilityTags(model);

  return {
    cultivatorId,
    productType: model.productType,
    name: model.name,
    description: model.description ?? null,
    element: extractElement(abilityTags) ?? null,
    quality: model.projectionQuality,
    slot: getSlot(model),
    score: calculateProductScore(model.balanceMetrics, model.affixes),
    isEquipped: false,
    productModel: serializeProductModel(model),
  };
}

function getAbilityTags(model: CreationProductModel): string[] {
  return model.battleProjection.abilityTags;
}

function getSlot(model: CreationProductModel): string | null {
  if (model.productType === 'artifact') {
    return (model as ArtifactProductModel).artifactConfig.slot ?? null;
  }
  return null;
}

/**
 * 序列化 ProductModel 为纯 JSON 对象。
 * battleProjection 不持久化（读取时从词缀注册表实时推导）。
 * affixes 数组仅保留 roll 参数，静态定义通过 affix.id 从注册表回填。
 */
export function serializeProductModel(
  model: CreationProductModel,
): Record<string, unknown> {
  const json = JSON.parse(JSON.stringify(model)) as Record<string, unknown>;
  delete json.battleProjection;
  const affixes = json.affixes;
  if (Array.isArray(affixes)) {
    json.affixes = affixes.map((affix: Record<string, unknown>) => ({
      id: affix.id,
      finalMultiplier: affix.finalMultiplier,
      rollScore: affix.rollScore,
      rollEfficiency: affix.rollEfficiency,
      isPerfect: affix.isPerfect,
      ...(Array.isArray(affix.modifierSelections)
        ? { modifierSelections: affix.modifierSelections }
        : {}),
    }));
  }
  return json;
}

export function deserializeProductModel(
  json: Record<string, unknown>,
): CreationProductModel {
  return json as unknown as CreationProductModel;
}

/**
 * 反序列化 + 实时推导：从存储的 slim JSON 恢复完整 CreationProductModel。
 * battleProjection 从词缀注册表实时重建，确保定义变更自动生效。
 */
export function deserializeAndRehydrate(
  json: Record<string, unknown>,
  elementBias?: import('@shared/types/constants').ElementType,
): CreationProductModel {
  const slim = json as unknown as CreationProductModel;
  if (!slim.productType) {
    return slim;
  }
  return rehydrateProductModel(slim, elementBias);
}

export function rehydrateStoredProductModel(
  json: Record<string, unknown> | null | undefined,
  elementBias?: ElementType,
): CreationProductModel | undefined {
  if (!json || !json.productType) {
    return undefined;
  }
  return deserializeAndRehydrate(json, elementBias);
}
