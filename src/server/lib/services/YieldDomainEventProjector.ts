import type { DbTransaction } from '@server/lib/drizzle/db';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
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
  const skeletons = MaterialGenerator.generateRandomSkeletons(
    event.data.materialCount,
    {
      qualityChanceMap: YieldCalculator.getMaterialQualityChanceMap(
        event.data.realm,
      ),
    },
    createDeterministicRng(`${event.id}:yield-material-plan`),
  );

  const attachments: MailAttachment[] = [];
  const selectedItemIds = new Set<string>();
  for (const [index, skeleton] of skeletons.entries()) {
    const seed = `${event.id}:yield-material:${index}`;
    const request = {
      materialTypes: buildMaterialTypePreferences(skeleton.type, seed),
      qualities: buildQualityPreferences(skeleton.rank),
      seed,
    };
    let entry = await sampleMaterialLibraryEntryByPreferences({
      ...request,
      excludeItemIds: selectedItemIds,
    });
    if (!entry) {
      entry = await sampleMaterialLibraryEntryByPreferences(request);
    }
    if (!entry) {
      throw new Error(`历练奖励道具库暂无可用材料: ${event.id}`);
    }

    selectedItemIds.add(entry.itemId);
    const material = {
      ...materialLibraryEntryToMaterial(entry),
      quantity: skeleton.quantity,
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
    '道友历练途中，偶得天材地宝，特以此传音玉简送达。',
    attachments,
    'reward',
    tx,
  );
  return {
    result: { status: 'created' as const },
    resourceChanges: [],
  };
}
