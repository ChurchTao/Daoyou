import type { DbTransaction } from '@server/lib/drizzle/db';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import { getFallbackMaterialPreset } from '@shared/engine/material/creation/fallbackPresets';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import type { MaterialSkeleton } from '@shared/engine/material/creation/types';
import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
import type { Material } from '@shared/types/cultivator';
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

function createFallbackMaterial(skeleton: MaterialSkeleton): Material {
  const preset = getFallbackMaterialPreset(skeleton.type, skeleton.rank);
  return {
    name: preset.name,
    type: skeleton.type,
    rank: skeleton.rank,
    element: skeleton.forcedElement ?? preset.element,
    description: preset.description,
    details: {},
    quantity: skeleton.quantity,
  };
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
      materialTypes: [skeleton.type],
      qualities: [skeleton.rank],
      seed,
    };
    let entry = await sampleMaterialLibraryEntryByPreferences({
      ...request,
      excludeItemIds: selectedItemIds,
    });
    if (!entry) {
      entry = await sampleMaterialLibraryEntryByPreferences(request);
    }
    if (entry) selectedItemIds.add(entry.itemId);
    const material = entry
      ? {
          ...materialLibraryEntryToMaterial(entry),
          quantity: skeleton.quantity,
        }
      : createFallbackMaterial(skeleton);
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
  await MailService.sendMail(
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
