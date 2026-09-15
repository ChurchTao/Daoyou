import { redis } from '@server/lib/redis';
import * as auctionRepository from '@server/lib/repositories/auctionRepository';
import {
  AUCTION_MAX_TRANSACTION_TOTAL,
  calculateAuctionSettlement,
} from '@shared/config/auctionConfig';
import { AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO } from '@shared/config/socialConfig';
import {
  auctionBlockReason,
  auctionItemCategory,
  auctionItemPriceCap,
  auctionItemQuality,
  AuctionSnapshotSchema,
  type AuctionListingView,
  type AuctionListRequest,
} from '@shared/contracts/auction';
import { itemDefinition, ItemGrantSchema } from '@shared/inventory';
import type { MailAttachment } from '@shared/types/mail';
import { and, eq, sql } from 'drizzle-orm';
import { getExecutor, type DbTransaction } from '../drizzle/db';
import * as schema from '../drizzle/schema';
import {
  assertFriend,
  FriendServiceError,
  getInviteTarget,
} from './FriendService';
import {
  assertInventoryIdle,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from './InventoryService';
import { publicMailAttachment } from './MailInventory';
import { MailService } from './MailService';
import {
  consumeFirstTalismanByScenario,
  TalismanScenarioError,
} from './TalismanScenarioService';

export class AuctionServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuctionServiceError';
  }
}
type AuctionMutationOptions = { tx?: DbTransaction; deferCacheClear?: boolean };
type Listing = auctionRepository.AuctionListing;

export async function clearAuctionListingsCache() {
  const keys = await redis.keys('auction:listings:*');
  if (keys.length) await redis.del(...keys);
}

function listingAttachment(listing: Listing, quantity: number): MailAttachment {
  const snapshot = AuctionSnapshotSchema.parse(listing.itemSnapshot);
  return {
    type: 'inventory_v1',
    name: listing.itemName,
    quantity,
    inventory: { ...snapshot.item, quantity },
  };
}

export function publicAuctionListing(listing: Listing): AuctionListingView {
  const attachment = publicMailAttachment(
    listingAttachment(listing, listing.remainingQuantity),
  );
  const item = attachment.inventory!;
  return {
    id: listing.id,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    itemType: itemDefinition(item.definitionId).kind,
    itemName: listing.itemName,
    itemQuality: listing.itemQuality,
    itemCategory: listing.itemCategory,
    item: {
      name: listing.itemName,
      definitionId: item.definitionId,
      instanceData: item.instanceData ?? null,
      quantity: listing.remainingQuantity,
    },
    price: listing.price,
    remainingQuantity: listing.remainingQuantity,
    visibility: listing.visibility as 'public' | 'private',
    targetCultivatorId: listing.targetCultivatorId,
    targetCultivatorName: listing.targetCultivatorName,
    expiresAt: listing.expiresAt.toISOString(),
  };
}

export async function listItem(
  input: AuctionListRequest & { cultivatorId: string; cultivatorName: string },
  options: AuctionMutationOptions = {},
) {
  const persist = async (tx: DbTransaction) => {
    const {
      cultivatorId: owner,
      itemId,
      revision,
      quantity,
      price,
      visibility,
      targetCultivatorId,
    } = input;
    await assertInventoryIdle(owner);
    if ((await auctionRepository.countActiveBySeller(owner, tx)) >= 5)
      throw new AuctionServiceError('MAX_LISTINGS', '寄售位已满（最多5个）');
    let targetCultivatorName: string | undefined;
    if (visibility === 'private') {
      if (!targetCultivatorId)
        throw new AuctionServiceError(
          'INVALID_VISIBILITY',
          '专属交易必须指定好友',
        );
      try {
        await assertFriend(owner, targetCultivatorId, tx);
        const target = await getInviteTarget(owner, targetCultivatorId, tx);
        targetCultivatorName = target.target.name;
        await consumeFirstTalismanByScenario(
          owner,
          AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO,
          tx,
        );
      } catch (error) {
        if (error instanceof FriendServiceError)
          throw new AuctionServiceError('TARGET_NOT_FRIEND', error.message);
        if (error instanceof TalismanScenarioError)
          throw new AuctionServiceError(
            'MISSING_TALISMAN',
            '缺少随身拍卖行贵宾符',
          );
        throw error;
      }
    }
    // Read after consuming the cost so the inventory plan cannot restore it.
    const before = (
      await tx
        .select()
        .from(schema.inventoryItems)
        .where(
          and(
            eq(schema.inventoryItems.cultivatorId, owner),
            eq(schema.inventoryItems.location, 'bag'),
          ),
        )
    ).map(inventoryItemOf);
    const item = before.find((i) => i.id === itemId);
    if (!item || item.revision !== revision || item.quantity < quantity)
      throw new InventoryError('物品已变化或数量不足，请重新选择');
    const equipped = await tx
      .select()
      .from(schema.cultivatorEquipmentSlots)
      .where(eq(schema.cultivatorEquipmentSlots.equipmentInstanceId, item.id))
      .limit(1);
    const reason = auctionBlockReason({
      ...item,
      equipped: equipped.length > 0,
    });
    if (reason) throw new InventoryError(reason);
    const cap = auctionItemPriceCap(item);
    if (price > cap)
      throw new AuctionServiceError(
        'INVALID_PRICE',
        '该物品单价不得超过 ' + cap.toLocaleString() + ' 灵石',
      );
    const grant = ItemGrantSchema.parse({
      definitionId: item.definitionId,
      quantity,
      ...(item.instanceData === null
        ? {}
        : { instanceData: item.instanceData }),
    });
    await saveInventoryPlan(
      owner,
      before,
      before.flatMap((row) =>
        row.id !== item.id
          ? [row]
          : row.quantity === quantity
            ? []
            : [
                {
                  ...row,
                  quantity: row.quantity - quantity,
                  revision: row.revision + 1,
                },
              ],
      ),
      tx,
    );
    const definition = itemDefinition(item.definitionId);
    const name =
      (item.instanceData as { name?: string } | null)?.name ?? definition.name;
    const listing = await auctionRepository.createListing({
      sellerId: owner,
      sellerName: input.cultivatorName,
      itemType: definition.kind,
      itemId,
      itemName: name,
      itemQuality: auctionItemQuality(item) ?? '',
      itemCategory: auctionItemCategory(item),
      itemSnapshot: AuctionSnapshotSchema.parse({
        version: 'inventory_v1',
        item: grant,
      }),
      price,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      visibility,
      targetCultivatorId,
      targetCultivatorName,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      tx,
    });
    return { listingId: listing.id, message: '物品已上架' };
  };
  const result = options.tx
    ? await persist(options.tx)
    : await getExecutor().transaction(persist);
  if (!options.deferCacheClear) await clearAuctionListingsCache();
  return result;
}

export async function buyItem(
  input: {
    listingId: string;
    quantity: number;
    buyerCultivatorId: string;
    buyerCultivatorName: string;
  },
  options: AuctionMutationOptions = {},
) {
  const persist = async (tx: DbTransaction) => {
    const { listingId, quantity, buyerCultivatorId } = input;
    const listing = await auctionRepository.findById(listingId, tx);
    if (!listing || listing.status !== 'active')
      throw new AuctionServiceError('LISTING_NOT_FOUND', '此物品已下架或售出');
    if (listing.expiresAt.getTime() <= Date.now())
      throw new AuctionServiceError('LISTING_EXPIRED', '货单已过期');
    if (
      listing.visibility === 'private' &&
      listing.targetCultivatorId !== buyerCultivatorId
    )
      throw new AuctionServiceError(
        'NOT_TARGET_BUYER',
        '此物为专属交易，不可购买',
      );
    const attachment = listingAttachment(listing, quantity);
    const { grossAmount, feeAmount, sellerAmount } = calculateAuctionSettlement(
      listing.price,
      quantity,
    );
    if (grossAmount > AUCTION_MAX_TRANSACTION_TOTAL)
      throw new AuctionServiceError(
        'INVALID_PRICE',
        '单次交易不得超过 ' +
          AUCTION_MAX_TRANSACTION_TOTAL.toLocaleString() +
          ' 灵石',
      );
    const [buyer] = await tx
      .select({ userId: schema.cultivators.userId })
      .from(schema.cultivators)
      .where(eq(schema.cultivators.id, buyerCultivatorId));
    const [seller] = await tx
      .select({ userId: schema.cultivators.userId })
      .from(schema.cultivators)
      .where(eq(schema.cultivators.id, listing.sellerId));
    if (buyer && seller && buyer.userId === seller.userId)
      throw new AuctionServiceError(
        'SAME_OWNER',
        '不可与自己账号下的角色进行交易',
      );
    const [paid] = await tx
      .update(schema.cultivators)
      .set({
        spirit_stones: sql`${schema.cultivators.spirit_stones} - ${grossAmount}`,
      })
      .where(
        and(
          eq(schema.cultivators.id, buyerCultivatorId),
          sql`${schema.cultivators.spirit_stones} >= ${grossAmount}`,
        ),
      )
      .returning({ id: schema.cultivators.id });
    if (!paid) throw new AuctionServiceError('INSUFFICIENT_FUNDS', '灵石不足');
    const sold = await auctionRepository.consumeListingQuantity(
      tx,
      listingId,
      quantity,
    );
    if (!sold)
      throw new AuctionServiceError(
        'LISTING_NOT_FOUND',
        '货单已变化或剩余数量不足',
      );
    await MailService.sendMail(
      buyerCultivatorId,
      '拍卖行交易成功',
      '已购入【' + listing.itemName + '】' + quantity + '件，请领取附件。',
      [attachment],
      'reward',
      tx,
    );
    await MailService.sendMail(
      listing.sellerId,
      '拍卖行物品售出',
      '【' +
        listing.itemName +
        '】成交' +
        quantity +
        '件，成交额' +
        grossAmount +
        '灵石，税费' +
        feeAmount +
        '灵石，实得' +
        sellerAmount +
        '灵石。',
      [{ type: 'spirit_stones', name: '灵石', quantity: sellerAmount }],
      'reward',
      tx,
    );
  };
  if (options.tx) await persist(options.tx);
  else await getExecutor().transaction(persist);
  if (!options.deferCacheClear) await clearAuctionListingsCache();
}

export async function cancelListing(
  listingId: string,
  cultivatorId: string,
  options: AuctionMutationOptions = {},
) {
  const persist = async (tx: DbTransaction) => {
    const cancelled = await auctionRepository.transitionStatus(
      tx,
      listingId,
      'active',
      'cancelled',
      { sellerId: cultivatorId },
    );
    if (!cancelled)
      throw new AuctionServiceError(
        'LISTING_NOT_FOUND',
        '货单不存在、已结束或不属于你',
      );
    await MailService.sendMail(
      cultivatorId,
      '拍卖行物品返还',
      '【' + cancelled.itemName + '】已下架，附件返还剩余物品。',
      [listingAttachment(cancelled, cancelled.remainingQuantity)],
      'reward',
      tx,
    );
  };
  if (options.tx) await persist(options.tx);
  else await getExecutor().transaction(persist);
  if (!options.deferCacheClear) await clearAuctionListingsCache();
}

export async function expireListings() {
  const count = await getExecutor().transaction(async (tx) => {
    const expired = await auctionRepository.markExpiredListings(tx);
    for (const listing of expired)
      await MailService.sendMail(
        listing.sellerId,
        '拍卖行物品过期',
        '【' + listing.itemName + '】已过期，附件返还剩余物品。',
        [listingAttachment(listing, listing.remainingQuantity)],
        'reward',
        tx,
      );
    return expired.length;
  });
  await clearAuctionListingsCache();
  return count;
}
