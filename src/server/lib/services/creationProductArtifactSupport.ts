import {
  deserializeAndRehydrate,
  deserializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import { DEFAULT_AFFIX_REGISTRY, flattenAffixMatcherTags } from '@shared/engine/creation-v2/affixes';
import type { AbilityConfig } from '@shared/engine/creation-v2/contracts/battle';
import type { CreationProductRecord } from '@server/lib/repositories/creationProductRepository';
import type { Artifact } from '@shared/types/cultivator';
import type { ElementType, Quality } from '@shared/types/constants';

function safeRecordJson(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

export function toArtifactFromProduct(record: CreationProductRecord): Artifact {
  const productModelJson = safeRecordJson(record.productModel);
  let abilityConfig: AbilityConfig | undefined;
  let enrichedModel: unknown;

  if (productModelJson.productType) {
    const rehydrated = deserializeAndRehydrate(
      productModelJson,
      (record.element as ElementType) || undefined,
    );
    abilityConfig = projectAbilityConfig(rehydrated);
    enrichedModel = enrichProductModelByAffixId(rehydrated);
  }

  return {
    id: record.id,
    name: record.name,
    slot: (record.slot as Artifact['slot']) || 'weapon',
    element: (record.element as Artifact['element']) || '金',
    quality: (record.quality as Artifact['quality']) || '凡品',
    description: record.description || undefined,
    attributeModifiers: abilityConfig?.modifiers ?? [],
    ...(abilityConfig ? { abilityConfig: { ...abilityConfig, slug: record.id } as unknown as Artifact['abilityConfig'] } : {}),
    score: record.score || 0,
    ...(record.isEquipped !== undefined ? { isEquipped: record.isEquipped } : {}),
    ...(enrichedModel ? { productModel: enrichedModel } : {}),
  } as Artifact;
}

function enrichProductModelByAffixId<T>(model: T): T {
  const productModel = model as {
    affixes?: Array<Record<string, unknown>>;
  };
  if (!productModel?.affixes?.length) return model;

  const affixes = productModel.affixes.map((affix) => {
    const id = affix.id as string | undefined;
    if (!id) return affix;
    const def = DEFAULT_AFFIX_REGISTRY.queryById(id);
    if (!def) return affix;
    return {
      ...affix,
      name: def.displayName,
      description: def.displayDescription,
      slot: def.slot,
      rarity: def.rarity,
      effectTemplate: def.effectTemplate,
      tags: flattenAffixMatcherTags(def.match),
      ...(def.grantedAbilityTags ? { grantedAbilityTags: def.grantedAbilityTags } : {}),
    };
  });

  return {
    ...(model as Record<string, unknown>),
    affixes,
  } as T;
}

export function getArtifactQualityFromProduct(
  record: Pick<CreationProductRecord, 'quality'>,
): Quality {
  const quality = record.quality as Quality | null;
  return quality || '凡品';
}

export function getArtifactEffectCountFromProduct(
  record: Pick<CreationProductRecord, 'productModel'>,
): number {
  const productModel = deserializeProductModel(safeRecordJson(record.productModel));
  const affixes = productModel.affixes?.length ?? 0;
  return affixes;
}

export function getArtifactStateHash(record: CreationProductRecord): string {
  try {
    return JSON.stringify({
      productModel: record.productModel ?? {},
      isEquipped: record.isEquipped,
    });
  } catch {
    return '{}';
  }
}
