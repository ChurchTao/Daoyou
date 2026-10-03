import {
  beastTradePreview,
  BeastTransferSchema,
} from '@daoyou/shared/contracts/beastTrade';
import { MailInventoryGrantSchema } from '@daoyou/shared/contracts/mail';
import { consumableFactsOf } from '@daoyou/shared/items/definitions/consumables';
import {
  INVENTORY_MATERIAL_TYPES,
  MaterialFactsSchema,
} from '@daoyou/shared/items/definitions/materials';
import { seedFactsOf, SeedFactsSchema } from '@daoyou/shared/items/definitions/seeds';
import { assertCurrentRewardItem } from '@daoyou/shared/lib/retiredDraw';
import type { Consumable, Material } from '@daoyou/shared/types/cultivator';
import type { MailAttachment } from '@daoyou/shared/types/mail';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { grantInventory } from '@server/inventory/operations.js';
import { sanitizeMaterialForClient } from '@server/inventory/application/materialDetailsPrivacy.js';

/** Only used when producing new rewards; never converts stored mail on claim. */
export function newRewardAttachment(item: MailAttachment): MailAttachment {
  assertCurrentRewardItem(
    item.type === 'inventory_v1' ? item.inventory?.instanceData : item.data,
  );
  if (item.type === 'consumable' && item.data)
    return {
      type: 'inventory_v1',
      name: item.name,
      quantity: item.quantity,
      inventory: {
        definitionId: 'consumable.v1',
        quantity: item.quantity,
        instanceData: consumableFactsOf(item.data as Consumable),
      },
    };
  if (item.type === 'material' && item.data) {
    const material = item.data as Material;
    if (
      !['seed', ...INVENTORY_MATERIAL_TYPES].includes(material.type)
    )
      return item;
    const facts =
      material.type === 'seed'
        ? seedFactsOf(material)
        : MaterialFactsSchema.parse({
            name: material.name,
            type: material.type,
            rank: material.rank,
            element: material.element ?? null,
            description: material.description ?? '',
          });
    return {
      type: 'inventory_v1',
      name: item.name,
      quantity: item.quantity,
      inventory: {
        definitionId: material.type === 'seed' ? 'seed.v1' : 'material.v1',
        quantity: item.quantity,
        instanceData: facts,
      },
    };
  }
  return item;
}

export function publicMailAttachment(item: MailAttachment): MailAttachment {
  if (item.type === 'beast_v1')
    return {
      type: 'beast_v1',
      name: item.name,
      quantity: 1,
      beastPreview: beastTradePreview(
        BeastTransferSchema.parse(item.beast).individual,
      ),
    };
  if (item.type === 'material' && item.data)
    return { ...item, data: sanitizeMaterialForClient(item.data as Material) };
  if (
    item.type === 'inventory_v1' &&
    item.inventory?.definitionId === 'seed.v1'
  ) {
    const { plant } = SeedFactsSchema.parse(
      item.inventory.instanceData,
    ).seedSpec;
    return {
      ...item,
      inventory: {
        ...item.inventory,
        instanceData: {
          seedPreview: {
            quality: plant.quality,
            element: plant.element,
            minRealm: plant.minRealm,
            seedDescription: plant.seedDescription,
            clueTexts: plant.clueTexts,
          },
        } as unknown as NonNullable<
          MailAttachment['inventory']
        >['instanceData'],
      },
    };
  }
  return item;
}

export async function deliverMailInventory(
  owner: string,
  attachments: MailAttachment[],
  tx: DbTransaction,
) {
  const grants = attachments
    .filter((a) => a.type === 'inventory_v1')
    .map((a) => {
      const grant = MailInventoryGrantSchema.parse(a.inventory);
      if (grant.quantity !== a.quantity) throw new Error('邮件物品数量不一致');
      return grant;
    });
  const delivered = await grantInventory(owner, grants, tx);
  return [
    ...new Set([
      ...delivered.map((item) => item.location),
      ...(attachments.some((a) =>
        ['material', 'consumable', 'artifact'].includes(a.type),
      )
        ? ['vault']
        : []),
    ]),
  ];
}
