/*
 * OutcomeSnapshot: 序列化/反序列化 CraftedOutcome 的工具。
 * 用于将产物快照写入数据库，并在恢复时通过 materializer 重新物化以保证可追溯性与一致性。
 */
import type { AbilityConfig } from '../contracts/battle';
import type { CreationProductModel } from '../models/types';
import { projectAbilityConfig } from '../models';
import type { CreationOutcomeMaterializer } from '../adapters/types';
import type {
  CraftedOutcome,
  CreationBlueprint,
  CreationProductType,
} from '../types';

export interface CraftedOutcomeSnapshot {
  productType: CreationProductType;
  blueprint: CreationBlueprint;
  productModel: CreationProductModel;
  abilityConfig: AbilityConfig;
}

export function snapshotCraftedOutcome(
  outcome: CraftedOutcome,
): CraftedOutcomeSnapshot {
  return {
    productType: outcome.blueprint.productModel.productType,
    blueprint: outcome.blueprint,
    productModel: outcome.blueprint.productModel,
    abilityConfig: projectAbilityConfig(outcome.blueprint.productModel),
  };
}

export function serializeCraftedOutcomeSnapshot(
  snapshot: CraftedOutcomeSnapshot,
): string {
  return JSON.stringify(snapshot);
}

export function deserializeCraftedOutcomeSnapshot(
  payload: string,
): CraftedOutcomeSnapshot {
  const snapshot = JSON.parse(payload) as CraftedOutcomeSnapshot;
  assertSnapshotShape(snapshot);
  return snapshot;
}

export function restoreCraftedOutcome(
  snapshot: CraftedOutcomeSnapshot,
  materializer: CreationOutcomeMaterializer,
): CraftedOutcome {
  const restored = materializer.materialize(
    snapshot.productType,
    snapshot.blueprint,
  );

  if (
    restored.blueprint.productModel.productType !== snapshot.productModel.productType ||
    restored.blueprint.productModel.slug !== snapshot.productModel.slug ||
    restored.blueprint.productModel.name !== snapshot.productModel.name
  ) {
    throw new Error(
      'Persisted outcome snapshot identity fields do not match current projection contract',
    );
  }

  return restored;
}

export function assertSnapshotShape(
  snapshot: CraftedOutcomeSnapshot,
): asserts snapshot is CraftedOutcomeSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Invalid crafted outcome snapshot payload');
  }

  if (!snapshot.productType) {
    throw new Error('Crafted outcome snapshot is missing identity fields');
  }

  if (!snapshot.blueprint || !snapshot.productModel || !snapshot.abilityConfig) {
    throw new Error('Crafted outcome snapshot is missing projection fields');
  }
}