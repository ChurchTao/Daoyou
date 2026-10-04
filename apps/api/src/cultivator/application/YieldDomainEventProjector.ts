import type { DbTransaction } from '@server/lib/drizzle/db.js';
import type { DomainEventEnvelope } from '@daoyou/contracts/events';
import type { ItemGrant } from '@daoyou/game-domain/inventory';
import { findItemDefinition } from '@daoyou/game-content/items';
import type { RealmType } from '@daoyou/constants/realms';
import { MailService, type MailAttachment } from '@server/mail/application/MailService.js';
import { generateRealmMaterials } from '@server/inventory/application/MaterialRewardService.js';

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
  const materials = await generateRealmMaterials(
    realm,
    count,
    `${seed}:yield-material`,
    unitQuantity,
  );
  return materials.map((material) => ({
    type: 'material',
    name: material.name,
    quantity: material.quantity,
    data: material,
  }));
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
