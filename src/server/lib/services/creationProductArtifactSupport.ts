import {
  deserializeAbilityConfig,
  deserializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { DEFAULT_AFFIX_REGISTRY, flattenAffixMatcherTags } from '@shared/engine/creation-v2/affixes';
import type { CreationProductRecord } from '@server/lib/repositories/creationProductRepository';
import type { Artifact } from '@shared/types/cultivator';
import type { Quality } from '@shared/types/constants';

function safeRecordJson(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

export function toArtifactFromProduct(record: CreationProductRecord): Artifact {
  const dbAbilityConfig = safeRecordJson(record.abilityConfig);
  const productModel = enrichProductModelByAffixId(
    deserializeProductModel(safeRecordJson(record.productModel)),
  );

  return {
    id: record.id,
    name: record.name,
    slot: (record.slot as Artifact['slot']) || 'weapon',
    element: (record.element as Artifact['element']) || '金',
    quality: (record.quality as Artifact['quality']) || '凡品',
    description: record.description || undefined,
    attributeModifiers:
      (dbAbilityConfig.modifiers as Artifact['attributeModifiers']) ?? [],
    abilityConfig: dbAbilityConfig as unknown as Artifact['abilityConfig'],
    score: record.score || 0,
    // 背包详情弹窗直接复用列表数据渲染词缀，保留原始结构。
    ...(record.isEquipped !== undefined ? { isEquipped: record.isEquipped } : {}),
    ...(productModel ? { productModel } : {}),
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
      category: def.category,
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
  record: Pick<CreationProductRecord, 'abilityConfig' | 'productModel'>,
): number {
  const abilityConfig = deserializeAbilityConfig(
    safeRecordJson(record.abilityConfig),
    'artifact-preview',
  );
  const productModel = deserializeProductModel(safeRecordJson(record.productModel));

  const directEffects = abilityConfig.effects?.length ?? 0;
  const listeners = abilityConfig.listeners?.length ?? 0;
  const modifiers = abilityConfig.modifiers?.length ?? 0;
  const affixes = productModel.affixes?.length ?? 0;

  return Math.max(directEffects + listeners + modifiers, affixes);
}

export function getArtifactStateHash(record: CreationProductRecord): string {
  try {
    return JSON.stringify({
      abilityConfig: record.abilityConfig ?? {},
      productModel: record.productModel ?? {},
      isEquipped: record.isEquipped,
    });
  } catch {
    return '{}';
  }
}
