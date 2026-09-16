import type { DbTransaction } from '@server/lib/drizzle/db';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
import type { ItemGrant } from '@shared/inventory';
import { findItemDefinition } from '@shared/items/registry';
import type { RealmType } from '@shared/types/constants';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_ORDER,
  QUALITY_VALUES,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import { MailService, type MailAttachment } from './MailService';
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

export async function generateYieldRewardAttachments(
  event: DomainEventEnvelope<'yield.claimed'>,
): Promise<MailAttachment[]> {
  if (event.data.rewardSnapshot) {
    return event.data.rewardSnapshot.items.map(yieldItemAttachment);
  }
  return generateYieldMaterials(
    event.data.realm,
    event.data.materialCount,
    event.id,
  );
}

function yieldItemAttachment(item: ItemGrant): MailAttachment {
  const definition = findItemDefinition(item.definitionId);
  if (!definition) throw new Error(`未知历练奖励: ${item.definitionId}`);
  const facts = item.instanceData as { name?: string } | undefined;
  return {
    type: 'inventory_v1',
    name: facts?.name ?? definition.name,
    quantity: item.quantity,
    inventory: item,
  };
}

export async function generateYieldMaterials(
  realm: RealmType,
  count: number,
  seed: string,
  unitQuantity = false,
): Promise<MailAttachment[]> {
  const skeletons = MaterialGenerator.generateRandomSkeletons(
    count,
    {
      qualityChanceMap: YieldCalculator.getMaterialQualityChanceMap(realm),
    },
    createDeterministicRng(`${seed}:yield-material-plan`),
  );

  const attachments: MailAttachment[] = [];
  const selectedItemIds = new Set<string>();
  for (const [index, skeleton] of skeletons.entries()) {
    const materialSeed = `${seed}:yield-material:${index}`;
    const request = {
      materialTypes: buildMaterialTypePreferences(skeleton.type, materialSeed),
      qualities: buildQualityPreferences(skeleton.rank),
      seed: materialSeed,
    };
    let entry = await sampleMaterialLibraryEntryByPreferences({
      ...request,
      excludeItemIds: selectedItemIds,
    });
    if (!entry) {
      entry = await sampleMaterialLibraryEntryByPreferences(request);
    }
    if (!entry) {
      throw new Error(`历练奖励道具库暂无可用材料: ${seed}`);
    }

    selectedItemIds.add(entry.itemId);
    const material = {
      ...materialLibraryEntryToMaterial(entry),
      quantity: unitQuantity ? 1 : skeleton.quantity,
    };
    attachments.push({
      type: 'material',
      name: material.name,
      quantity: material.quantity,
      data: material,
    });
  }
  return attachments;
}

export async function projectYieldReward(
  event: DomainEventEnvelope<'yield.claimed'>,
  attachments: MailAttachment[],
  tx: DbTransaction,
) {
  await MailService.sendNewRewardMail(
    event.data.cultivatorId,
    '历练机缘',
    '道友历练途中有所收获，特以此传音玉简送达。',
    attachments,
    'reward',
    tx,
  );
  return {
    result: { status: 'created' as const },
    resourceChanges: [],
  };
}
