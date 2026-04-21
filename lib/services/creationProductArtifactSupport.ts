import { deserializeAbilityConfig, deserializeProductModel } from '@/engine/creation-v2/persistence/ProductPersistenceMapper';
import type { CreationProductRecord } from '@/lib/repositories/creationProductRepository';
import type { Artifact } from '@/types/cultivator';
import type { Quality } from '@/types/constants';

function safeRecordJson(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

export function toArtifactFromProduct(record: CreationProductRecord): Artifact {
  const abilityConfig = deserializeAbilityConfig(
    safeRecordJson(record.abilityConfig),
    record.id,
  );

  return {
    id: record.id,
    name: record.name,
    slot: (record.slot as Artifact['slot']) || 'weapon',
    element: (record.element as Artifact['element']) || '金',
    quality: (record.quality as Artifact['quality']) || '凡品',
    required_realm: undefined,
    description: record.description || undefined,
    attributeModifiers: abilityConfig.modifiers ?? [],
    abilityConfig,
    score: record.score || 0,
  };
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
