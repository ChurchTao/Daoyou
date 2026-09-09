import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import type { PlayerLoadout } from '@shared/contracts/player';
import { legacyModifiers, legacyRecord } from '@shared/legacy/products';
import type { ElementType, Quality } from '@shared/types/constants';
import type { Cultivator, EquippedItems } from '@shared/types/cultivator';
import { toArtifactFromProduct } from '../creationProductArtifactSupport';
import { mapArtifactRow } from './CultivatorInventoryRepository';

export function mapLoadoutFromProducts(
  products: Awaited<
    ReturnType<typeof creationProductRepository.findEquippedByType>
  >[],
): PlayerLoadout {
  const flatProducts = products.flat();
  const skillProducts = flatProducts.filter(
    (product) => product.productType === 'skill' && product.isEquipped,
  );
  const gongfaProducts = flatProducts.filter(
    (product) => product.productType === 'gongfa' && product.isEquipped,
  );
  const artifactProducts = flatProducts.filter(
    (product) => product.productType === 'artifact' && product.isEquipped,
  );

  const cultivations: Cultivator['cultivations'] = gongfaProducts.map(
    (product) => {
      return {
        id: product.id,
        name: product.name,
        element: (product.element as ElementType) || undefined,
        quality: product.quality as Quality | undefined,
        score: product.score || 0,
        description: product.description || undefined,
        attributeModifiers: legacyModifiers(
          legacyRecord(product.productModel).attributeModifiers,
        ),
        productModel: product.productModel ?? undefined,
      };
    },
  );

  const skills: Cultivator['skills'] = skillProducts.map((product) => {
    return {
      id: product.id,
      name: product.name,
      element: (product.element as ElementType) || '金',
      quality: product.quality as Quality | undefined,
      cooldown: 0,
      description: product.description || undefined,
      productModel: product.productModel ?? undefined,
    };
  });
  const artifacts = artifactProducts.map((artifact) =>
    mapArtifactRow(toArtifactFromProduct(artifact)),
  );
  const equipped: EquippedItems = {
    weapon:
      artifactProducts.find((product) => product.slot === 'weapon')?.id ?? null,
    armor:
      artifactProducts.find((product) => product.slot === 'armor')?.id ?? null,
    accessory:
      artifactProducts.find((product) => product.slot === 'accessory')?.id ??
      null,
  };
  return { skills, cultivations, artifacts, equipped };
}

export async function getPlayerLoadoutByCultivatorId(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<PlayerLoadout> {
  const q = executor ?? getExecutor();
  const [skills, cultivations, artifacts] = await runDbTasks(q, [
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'skill', q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'gongfa', q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'artifact', q),
  ]);
  return mapLoadoutFromProducts([skills, cultivations, artifacts]);
}
