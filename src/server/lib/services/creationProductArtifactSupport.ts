import type { CreationProductRecord } from '@server/lib/repositories/creationProductRepository';
import { legacyModifiers, legacyRecord } from '@shared/legacy/products';
import type { Artifact } from '@shared/types/cultivator';

function safeRecordJson(value: unknown): Record<string, unknown> {
  return legacyRecord(value);
}

export function toArtifactFromProduct(record: CreationProductRecord): Artifact {
  const productModelJson = safeRecordJson(record.productModel);

  return {
    id: record.id,
    name: record.name,
    slot: (record.slot as Artifact['slot']) || 'weapon',
    element: (record.element as Artifact['element']) || '金',
    quality: (record.quality as Artifact['quality']) || '凡品',
    description: record.description || undefined,
    attributeModifiers: legacyModifiers(productModelJson.attributeModifiers),
    score: record.score || 0,
    ...(record.isEquipped !== undefined
      ? { isEquipped: record.isEquipped }
      : {}),
    productModel: productModelJson,
  } as Artifact;
}

export function getArtifactEffectCountFromProduct(
  record: Pick<CreationProductRecord, 'productModel'>,
): number {
  const productModel = legacyRecord(record.productModel);
  const affixes = Array.isArray(productModel.affixes)
    ? productModel.affixes.length
    : 0;
  return affixes;
}
