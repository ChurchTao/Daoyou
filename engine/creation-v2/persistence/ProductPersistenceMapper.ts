import type { CreationProductInsert } from '@/lib/repositories/creationProductRepository';
import type { AbilityConfig } from '../contracts/battle';
import { projectAbilityConfig } from '../models/AbilityProjection';
import type {
  ArtifactProductModel,
  CreationProductModel,
} from '../models/types';
import type { CraftedOutcome } from '../types';
import { extractElement } from './elementExtractor';
import { calculateProductScore, deriveQuality } from './ScoreCalculator';

export type ProductRow = Omit<CreationProductInsert, 'id'>;

/**
 * 将 CraftedOutcome 映射为 creation_products 表的插入行。
 * 调用方在拿到 row 后负责 DB 写入，引擎层不直接操作数据库。
 */
export function toRow(
  outcome: CraftedOutcome,
  cultivatorId: string,
): ProductRow {
  const model = outcome.blueprint.productModel;
  const abilityConfig = projectAbilityConfig(model);
  const abilityTags = getAbilityTags(model);

  return {
    cultivatorId,
    productType: model.productType,
    name: model.name,
    description: model.description ?? null,
    element: extractElement(abilityTags) ?? null,
    quality: deriveQuality(model.balanceMetrics),
    slot: getSlot(model),
    score: calculateProductScore(model.balanceMetrics, model.affixes),
    isEquipped: false,
    abilityConfig: serializeAbilityConfig(abilityConfig),
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
 * 序列化 AbilityConfig 为纯 JSON 对象（可存入 JSONB）。
 */
export function serializeAbilityConfig(
  config: AbilityConfig,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config));
}

/**
 * 反序列化 JSONB → AbilityConfig，用 DB id 替换 slug 作为运行时标识。
 */
export function deserializeAbilityConfig(
  json: Record<string, unknown>,
  dbId: string,
): AbilityConfig {
  const config = json as unknown as AbilityConfig;
  return { ...config, slug: dbId };
}

/**
 * 序列化完整 ProductModel 为纯 JSON 对象。
 */
export function serializeProductModel(
  model: CreationProductModel,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(model));
}

/**
 * 反序列化 JSONB → CreationProductModel。
 */
export function deserializeProductModel(
  json: Record<string, unknown>,
): CreationProductModel {
  return json as unknown as CreationProductModel;
}
