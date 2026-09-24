import type { DbExecutor } from '@server/lib/drizzle/db';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_ORDER,
  QUALITY_VALUES,
  type MaterialType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import {
  materialLibraryEntryToMaterial,
  sampleMaterialLibraryEntryByPreferences,
} from './MaterialLibraryService';
import { computeItemLibrarySampleKey } from './itemLibrarySampleKey';

function createDeterministicRng(seed: string): () => number {
  let index = 0;
  return () => computeItemLibrarySampleKey(`${seed}:${index++}`);
}

function buildMaterialTypePreferences(
  target: MaterialType,
  seed: string,
): MaterialType[] {
  return [
    target,
    ...MATERIAL_TYPE_VALUES.filter((type) => type !== target).sort(
      (left, right) =>
        computeItemLibrarySampleKey(`${seed}:${left}`) -
        computeItemLibrarySampleKey(`${seed}:${right}`),
    ),
  ];
}

function buildQualityPreferences(target: Quality): Quality[] {
  return [...QUALITY_VALUES].sort((left, right) => {
    const distance =
      Math.abs(QUALITY_ORDER[left] - QUALITY_ORDER[target]) -
      Math.abs(QUALITY_ORDER[right] - QUALITY_ORDER[target]);
    return distance || QUALITY_ORDER[left] - QUALITY_ORDER[right];
  });
}

export async function generateRealmMaterials(
  realm: RealmType,
  count: number,
  seed: string,
  unitQuantity = false,
  executor?: DbExecutor,
): Promise<Material[]> {
  const skeletons = MaterialGenerator.generateRandomSkeletons(
    count,
    {
      qualityChanceMap: YieldCalculator.getMaterialQualityChanceMap(realm),
    },
    createDeterministicRng(`${seed}-plan`),
  );

  const materials: Material[] = [];
  const selectedItemIds = new Set<string>();
  for (const [index, skeleton] of skeletons.entries()) {
    const materialSeed = `${seed}:${index}`;
    const request = {
      materialTypes: buildMaterialTypePreferences(skeleton.type, materialSeed),
      qualities: buildQualityPreferences(skeleton.rank),
      seed: materialSeed,
    };
    let entry = await sampleMaterialLibraryEntryByPreferences(
      {
        ...request,
        excludeItemIds: selectedItemIds,
      },
      executor,
    );
    if (!entry) {
      entry = await sampleMaterialLibraryEntryByPreferences(request, executor);
    }
    if (!entry) {
      throw new Error(`奖励道具库暂无可用材料: ${seed}`);
    }

    selectedItemIds.add(entry.itemId);
    const material = {
      ...materialLibraryEntryToMaterial(entry),
      quantity: unitQuantity ? 1 : skeleton.quantity,
    };
    materials.push(material);
  }
  return materials;
}
