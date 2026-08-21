import { redis } from '@server/lib/redis';
import * as auctionRepository from '@server/lib/repositories/auctionRepository';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import {
  AUCTION_MAX_TRANSACTION_TOTAL,
  AUCTION_MAX_UNIT_PRICE,
  calculateAuctionSettlement,
  getAuctionUnitPriceCap,
  isAuctionListableMaterial,
  isAuctionListableQuality,
} from '@shared/config/auctionConfig';
import { AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO } from '@shared/config/socialConfig';
import {
  TEMP_DISABLED_MESSAGES,
  temporaryRestrictions,
} from '@shared/config/temporaryRestrictions';
import { isPillConsumable } from '@shared/lib/consumables';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { and, eq, sql } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import * as schema from '../drizzle/schema';
import { mapConsumableRow } from './consumablePersistence';
import { toArtifactFromProduct } from './creationProductArtifactSupport';
import { mapMaterialRow } from './cultivator/CultivatorInventoryRepository';
import {
  assertFriend,
  FriendServiceError,
  getInviteTarget,
} from './FriendService';
import { MailService } from './MailService';
import {
  consumeFirstTalismanByScenario,
  TalismanScenarioError,
} from './TalismanScenarioService';

// ============================================================================
// Constants
// ============================================================================

const AUCTION_CACHE_PREFIX = 'auction:';

const MAX_ACTIVE_LISTINGS_PER_SELLER = 5;
const LISTING_DURATION_HOURS = 48;

// ============================================================================
// Error Codes
// ============================================================================

export const AuctionError = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  LISTING_NOT_FOUND: 'LISTING_NOT_FOUND',
  LISTING_EXPIRED: 'LISTING_EXPIRED',
  NOT_OWNER: 'NOT_OWNER',
  MAX_LISTINGS: 'MAX_LISTINGS',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  CONCURRENT_PURCHASE: 'CONCURRENT_PURCHASE',
  INVALID_ITEM_TYPE: 'INVALID_ITEM_TYPE',
  INVALID_PRICE: 'INVALID_PRICE',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INVALID_ITEM_QUALITY: 'INVALID_ITEM_QUALITY',
  CONSUMABLE_LISTING_DISABLED: 'CONSUMABLE_LISTING_DISABLED',
  SAME_OWNER: 'SAME_OWNER',
  INVALID_VISIBILITY: 'INVALID_VISIBILITY',
  TARGET_NOT_FRIEND: 'TARGET_NOT_FRIEND',
  MISSING_TALISMAN: 'MISSING_TALISMAN',
  NOT_TARGET_BUYER: 'NOT_TARGET_BUYER',
} as const;

export type AuctionErrorCode = (typeof AuctionError)[keyof typeof AuctionError];

export type AuctionItemType = 'material' | 'artifact' | 'consumable';
export type AuctionListingVisibility = 'public' | 'private';

export class AuctionServiceError extends Error {
  constructor(
    public code: AuctionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuctionServiceError';
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ListItemInput {
  userId: string;
  cultivatorId: string;
  cultivatorName: string;
  itemType: AuctionItemType;
  itemId: string;
  price: number;
  quantity: number;
  visibility?: AuctionListingVisibility;
  targetCultivatorId?: string;
}

export interface ListItemResult {
  listingId: string;
  message: string;
}

export type AuctionInventoryChange =
  | {
      kind: 'materials';
      operation: 'upsert';
      item: Material;
    }
  | {
      kind: 'consumables';
      operation: 'upsert';
      item: Consumable;
    }
  | {
      kind: 'materials' | 'artifacts' | 'consumables';
      operation: 'remove';
      id: string;
    };

export interface BuyItemInput {
  listingId: string;
  quantity: number;
  buyerCultivatorId: string;
  buyerCultivatorName: string;
}

export interface AuctionMutationOptions {
  tx?: DbTransaction;
  deferCacheClear?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 获取物品快照（完整数据）
 */
async function getArtifactProductSnapshot(
  itemId: string,
  cultivatorId: string,
  executor: DbExecutor = getExecutor(),
) {
  const rows = await creationProductRepository.findArtifactsByIdsAndCultivator(
    cultivatorId,
    [itemId],
    executor,
  );

  return rows[0] || null;
}

export async function getAuctionItemSnapshot(
  itemType: AuctionItemType,
  itemId: string,
  cultivatorId: string,
  executor: DbExecutor = getExecutor(),
): Promise<Material | Artifact | Consumable | null> {
  const q = executor;
  switch (itemType) {
    case 'material': {
      const [material] = await q
        .select()
        .from(schema.materials)
        .where(
          and(
            eq(schema.materials.id, itemId),
            eq(schema.materials.cultivatorId, cultivatorId),
          ),
        )
        .limit(1);
      return material ? mapMaterialRow(material) : null;
    }
    case 'artifact': {
      const artifact = await getArtifactProductSnapshot(
        itemId,
        cultivatorId,
        q,
      );
      return artifact ? toArtifactFromProduct(artifact) : null;
    }
    case 'consumable': {
      const [consumable] = await q
        .select()
        .from(schema.consumables)
        .where(
          and(
            eq(schema.consumables.id, itemId),
            eq(schema.consumables.cultivatorId, cultivatorId),
          ),
        )
        .limit(1);
      return consumable ? mapConsumableRow(consumable) : null;
    }
    default:
      return null;
  }
}

/**
 * 清除拍卖列表缓存
 */
export async function clearAuctionListingsCache(): Promise<void> {
  // 使用 SCAN 查找所有拍卖列表缓存并删除
  // 简化实现：使用模式匹配删除
  // 注意：生产环境可能需要更精细的缓存管理
  const keys = await redis.keys(`${AUCTION_CACHE_PREFIX}listings:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export function normalizeAuctionItemQuality(
  itemType: AuctionItemType,
  item: Material | Artifact | Consumable,
): Quality {
  if (itemType === 'material') {
    return (item as Material).rank;
  }

  const quality = (item as Artifact | Consumable).quality || '凡品';
  return quality in QUALITY_ORDER ? quality : '凡品';
}

export function getAuctionItemCategory(
  itemType: AuctionItemType,
  item: Material | Artifact | Consumable,
): string {
  switch (itemType) {
    case 'material':
      return (item as Material).type;
    case 'artifact':
      return (item as Artifact).slot;
    case 'consumable':
      return (item as Consumable).type;
  }
}

export function assertAuctionListableItem(
  itemType: AuctionItemType,
  itemSnapshot: Material | Artifact | Consumable,
  quantity: number,
): void {
  if ((itemSnapshot as Artifact).isEquipped) {
    throw new AuctionServiceError(
      AuctionError.INVALID_ITEM_TYPE,
      '已装备法宝不可寄售，请先卸下',
    );
  }
  if (
    itemType === 'consumable' &&
    !isPillConsumable(itemSnapshot as Consumable)
  ) {
    throw new AuctionServiceError(
      AuctionError.INVALID_ITEM_TYPE,
      '当前仅支持丹药寄售',
    );
  }

  const itemQuality = normalizeAuctionItemQuality(itemType, itemSnapshot);
  const qualityOk =
    itemType === 'material'
      ? isAuctionListableMaterial(itemSnapshot as Material)
      : isAuctionListableQuality(itemQuality);
  if (!qualityOk) {
    throw new AuctionServiceError(
      AuctionError.INVALID_ITEM_QUALITY,
      `仅玄品及以上物品可寄售（灵田种子除外），当前为${itemQuality}`,
    );
  }

  if (itemType === 'artifact' && quantity !== 1) {
    throw new AuctionServiceError(
      AuctionError.INVALID_QUANTITY,
      '法宝每次只能上架 1 件',
    );
  }

  const availableQuantity =
    itemType === 'artifact'
      ? 1
      : 'quantity' in itemSnapshot
        ? itemSnapshot.quantity
        : 0;
  if (itemType !== 'artifact' && quantity > availableQuantity) {
    throw new AuctionServiceError(
      AuctionError.INVALID_QUANTITY,
      `上架数量不足，当前仅有 ${availableQuantity}`,
    );
  }
}

// ============================================================================
// Main Service Methods
// ============================================================================

/**
 * 上架物品
 */
export async function listItem(
  input: ListItemInput,
  options: AuctionMutationOptions = {},
): Promise<{
  result: ListItemResult;
  inventoryChanges: AuctionInventoryChange[];
}> {
  const q = getExecutor(options.tx);
  const {
    cultivatorId,
    cultivatorName,
    itemType,
    itemId,
    price,
    quantity,
    targetCultivatorId,
  } = input;
  const visibility = input.visibility ?? 'public';
  let targetCultivatorName: string | undefined;

  // 1. 校验价格（全局上限）
  if (price < 1) {
    throw new AuctionServiceError(
      AuctionError.INVALID_PRICE,
      '价格必须至少为 1 灵石',
    );
  }
  if (price > AUCTION_MAX_UNIT_PRICE) {
    throw new AuctionServiceError(
      AuctionError.INVALID_PRICE,
      `单价不得超过 ${AUCTION_MAX_UNIT_PRICE.toLocaleString()} 灵石`,
    );
  }

  // 2. 校验数量
  if (quantity < 1) {
    throw new AuctionServiceError(
      AuctionError.INVALID_QUANTITY,
      '上架数量必须至少为 1',
    );
  }

  // 3. 校验物品类型
  if (!['material', 'artifact', 'consumable'].includes(itemType)) {
    throw new AuctionServiceError(
      AuctionError.INVALID_ITEM_TYPE,
      '无效的物品类型',
    );
  }

  if (!['public', 'private'].includes(visibility)) {
    throw new AuctionServiceError(
      AuctionError.INVALID_VISIBILITY,
      '无效的拍卖可见范围',
    );
  }
  if (visibility === 'private') {
    if (!targetCultivatorId) {
      throw new AuctionServiceError(
        AuctionError.INVALID_VISIBILITY,
        '专属交易必须指定好友',
      );
    }
    try {
      const target = await getInviteTarget(cultivatorId, targetCultivatorId, q);
      if (!target.isFriend) {
        throw new AuctionServiceError(
          AuctionError.TARGET_NOT_FRIEND,
          '专属交易只能指定好友名录中的道友',
        );
      }
      targetCultivatorName = target.target.name;
    } catch (error) {
      if (error instanceof FriendServiceError) {
        throw new AuctionServiceError(
          error.status === 403
            ? AuctionError.TARGET_NOT_FRIEND
            : AuctionError.ITEM_NOT_FOUND,
          error.message,
        );
      }
      throw error;
    }
  }

  if (
    temporaryRestrictions.disableConsumableAuctionListing &&
    itemType === 'consumable'
  ) {
    throw new AuctionServiceError(
      AuctionError.CONSUMABLE_LISTING_DISABLED,
      TEMP_DISABLED_MESSAGES.consumableAuctionListing,
    );
  }

  // 分布式锁由 API/Application 层统一获取。
  // 5. 校验寄售位数量
  const activeCount = await auctionRepository.countActiveBySeller(
    cultivatorId,
    q,
  );
  if (activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
    throw new AuctionServiceError(
      AuctionError.MAX_LISTINGS,
      `寄售位已满（最多${MAX_ACTIVE_LISTINGS_PER_SELLER}个）`,
    );
  }

  // 6. 获取物品快照并校验所有权
  const itemSnapshot = await getAuctionItemSnapshot(
    itemType,
    itemId,
    cultivatorId,
    q,
  );
  if (!itemSnapshot) {
    throw new AuctionServiceError(
      AuctionError.ITEM_NOT_FOUND,
      '物品不存在或已消耗',
    );
  }
  assertAuctionListableItem(itemType, itemSnapshot, quantity);
  const itemQuality = normalizeAuctionItemQuality(itemType, itemSnapshot);

  // 按品质校验价格上限
  const qualityCap = getAuctionUnitPriceCap(itemQuality);
  if (price > qualityCap) {
    throw new AuctionServiceError(
      AuctionError.INVALID_PRICE,
      `${itemQuality}物品单价不得超过 ${qualityCap.toLocaleString()} 灵石`,
    );
  }

  // 7. 在事务中：扣减/删除物品 + 创建拍卖记录
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + LISTING_DURATION_HOURS);

  const persistListing = async (
    tx: DbTransaction,
  ): Promise<AuctionInventoryChange[]> => {
    const inventoryChanges: AuctionInventoryChange[] = [];
    // 事务内二次校验并按数量扣减
    const ownedItem = await getAuctionItemSnapshot(
      itemType,
      itemId,
      cultivatorId,
      tx,
    );
    if (!ownedItem) {
      throw new AuctionServiceError(
        AuctionError.ITEM_NOT_FOUND,
        '物品不存在或已被消耗',
      );
    }
    assertAuctionListableItem(itemType, ownedItem, quantity);

    if (visibility === 'private') {
      if (!targetCultivatorId) {
        throw new AuctionServiceError(
          AuctionError.INVALID_VISIBILITY,
          '专属交易必须指定好友',
        );
      }
      try {
        await assertFriend(cultivatorId, targetCultivatorId, tx);
        const consumedTalisman = await consumeFirstTalismanByScenario(
          cultivatorId,
          AUCTION_PRIVATE_LISTING_TALISMAN_SCENARIO,
          tx,
        );
        inventoryChanges.push(
          consumedTalisman.remaining
            ? {
                kind: 'consumables',
                operation: 'upsert',
                item: consumedTalisman.remaining,
              }
            : {
                kind: 'consumables',
                operation: 'remove',
                id: consumedTalisman.itemId,
              },
        );
      } catch (error) {
        if (error instanceof FriendServiceError) {
          throw new AuctionServiceError(
            AuctionError.TARGET_NOT_FRIEND,
            error.message,
          );
        }
        if (error instanceof TalismanScenarioError) {
          throw new AuctionServiceError(
            AuctionError.MISSING_TALISMAN,
            '缺少拍卖行贵宾符，可前往天骄宝阁购买后再上架专属交易',
          );
        }
        throw error;
      }
    }

    const listingSnapshot =
      itemType === 'artifact'
        ? ownedItem
        : ({ ...ownedItem, quantity } as Material | Consumable);

    if (itemType === 'artifact') {
      const artifact = await getArtifactProductSnapshot(
        itemId,
        cultivatorId,
        tx,
      );
      if (!artifact) {
        throw new AuctionServiceError(
          AuctionError.ITEM_NOT_FOUND,
          '物品不存在或已被消耗',
        );
      }
      if (artifact.isEquipped) {
        throw new AuctionServiceError(
          AuctionError.INVALID_ITEM_TYPE,
          '已装备法宝不可寄售，请先卸下',
        );
      }

      const deleted =
        await creationProductRepository.deleteArtifactsByIdsAndCultivator(
          cultivatorId,
          [itemId],
          tx,
        );

      if (deleted.length !== 1) {
        throw new AuctionServiceError(
          AuctionError.ITEM_NOT_FOUND,
          '物品不存在或已被消耗',
        );
      }
      inventoryChanges.push({
        kind: 'artifacts',
        operation: 'remove',
        id: itemId,
      });
    } else if (itemType === 'material') {
      const current = ownedItem as Material;
      if (quantity > current.quantity) {
        throw new AuctionServiceError(
          AuctionError.INVALID_QUANTITY,
          `上架数量不足，当前仅有 ${current.quantity}`,
        );
      }

      if (quantity === current.quantity) {
        await tx
          .delete(schema.materials)
          .where(
            and(
              eq(schema.materials.id, itemId),
              eq(schema.materials.cultivatorId, cultivatorId),
            ),
          );
        inventoryChanges.push({
          kind: 'materials',
          operation: 'remove',
          id: itemId,
        });
      } else {
        await tx
          .update(schema.materials)
          .set({ quantity: current.quantity - quantity })
          .where(
            and(
              eq(schema.materials.id, itemId),
              eq(schema.materials.cultivatorId, cultivatorId),
            ),
          );
        inventoryChanges.push({
          kind: 'materials',
          operation: 'upsert',
          item: { ...current, quantity: current.quantity - quantity },
        });
      }
    } else {
      const current = ownedItem as Consumable;
      if (quantity > current.quantity) {
        throw new AuctionServiceError(
          AuctionError.INVALID_QUANTITY,
          `上架数量不足，当前仅有 ${current.quantity}`,
        );
      }

      if (quantity === current.quantity) {
        await tx
          .delete(schema.consumables)
          .where(
            and(
              eq(schema.consumables.id, itemId),
              eq(schema.consumables.cultivatorId, cultivatorId),
            ),
          );
        inventoryChanges.push({
          kind: 'consumables',
          operation: 'remove',
          id: itemId,
        });
      } else {
        await tx
          .update(schema.consumables)
          .set({ quantity: current.quantity - quantity })
          .where(
            and(
              eq(schema.consumables.id, itemId),
              eq(schema.consumables.cultivatorId, cultivatorId),
            ),
          );
        inventoryChanges.push({
          kind: 'consumables',
          operation: 'upsert',
          item: { ...current, quantity: current.quantity - quantity },
        });
      }
    }

    // 创建拍卖记录
    await auctionRepository.createListing({
      sellerId: cultivatorId,
      sellerName: cultivatorName,
      itemType,
      itemId,
      itemName: listingSnapshot.name,
      itemQuality: normalizeAuctionItemQuality(itemType, listingSnapshot),
      itemCategory: getAuctionItemCategory(itemType, listingSnapshot),
      itemSnapshot: listingSnapshot,
      price,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      visibility,
      targetCultivatorId:
        visibility === 'private' ? targetCultivatorId : undefined,
      targetCultivatorName:
        visibility === 'private' ? targetCultivatorName : undefined,
      expiresAt,
      tx,
    });
    return inventoryChanges;
  };

  const inventoryChanges = options.tx
    ? await persistListing(options.tx)
    : await getExecutor().transaction(persistListing);

  // 8. 清除缓存
  if (!options.deferCacheClear) {
    await clearAuctionListingsCache();
  }

  return {
    result: {
      listingId: itemId, // 实际上是拍卖记录ID，这里简化返回
      message: '物品已成功寄售',
    },
    inventoryChanges,
  };
}

/**
 * 购买物品
 */
export async function buyItem(
  input: BuyItemInput,
  options: AuctionMutationOptions = {},
): Promise<void> {
  const q = getExecutor(options.tx);
  const { listingId, quantity, buyerCultivatorId } = input;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AuctionServiceError(
      AuctionError.INVALID_QUANTITY,
      '购买数量必须至少为 1',
    );
  }

  // 分布式锁由 API/Application 层统一获取。
  // 2. 查询拍卖记录
  const listing = await auctionRepository.findById(listingId, q);
  if (!listing) {
    throw new AuctionServiceError(
      AuctionError.LISTING_NOT_FOUND,
      '此物品已下架或售出',
    );
  }

  // 3. 校验状态和过期时间
  if (listing.status !== 'active') {
    throw new AuctionServiceError(
      AuctionError.LISTING_NOT_FOUND,
      '此物品已下架或售出',
    );
  }
  if (new Date() > listing.expiresAt) {
    throw new AuctionServiceError(AuctionError.LISTING_EXPIRED, '此拍卖已过期');
  }
  if (quantity > listing.remainingQuantity) {
    throw new AuctionServiceError(
      AuctionError.INVALID_QUANTITY,
      `购买数量不足，当前仅剩 ${listing.remainingQuantity}`,
    );
  }

  // 4. 不能购买自己的物品
  if (listing.sellerId === buyerCultivatorId) {
    throw new AuctionServiceError(
      AuctionError.NOT_OWNER,
      '无法购买自己寄售的物品',
    );
  }
  if (
    listing.visibility === 'private' &&
    listing.targetCultivatorId !== buyerCultivatorId
  ) {
    throw new AuctionServiceError(
      AuctionError.NOT_TARGET_BUYER,
      '此物为专属交易，不可购买',
    );
  }

  const settlement = calculateAuctionSettlement(listing.price, quantity);
  if (settlement.grossAmount > AUCTION_MAX_TRANSACTION_TOTAL) {
    throw new AuctionServiceError(
      AuctionError.INVALID_PRICE,
      `单次购买总价不得超过 ${AUCTION_MAX_TRANSACTION_TOTAL.toLocaleString()} 灵石`,
    );
  }
  const price = settlement.grossAmount;
  const { feeAmount, sellerAmount } = settlement;

  // 5. 事务：扣除买家灵石 + 更新拍卖状态 + 发送邮件
  const persistPurchase = async (tx: DbTransaction) => {
    // 5.0 禁止同一用户（userId）下不同角色之间的交易（防止小号对敲刷灵石）
    const [buyerRow] = await tx
      .select({ userId: schema.cultivators.userId })
      .from(schema.cultivators)
      .where(eq(schema.cultivators.id, buyerCultivatorId))
      .limit(1);
    const [sellerRow] = await tx
      .select({ userId: schema.cultivators.userId })
      .from(schema.cultivators)
      .where(eq(schema.cultivators.id, listing.sellerId))
      .limit(1);

    if (buyerRow && sellerRow && buyerRow.userId === sellerRow.userId) {
      throw new AuctionServiceError(
        AuctionError.SAME_OWNER,
        '不可与自己账号下的角色进行交易',
      );
    }

    // 5.1 扣除买家灵石（原子操作）
    const [updatedBuyer] = await tx
      .update(schema.cultivators)
      .set({
        spirit_stones: sql`${schema.cultivators.spirit_stones} - ${price}`,
      })
      .where(
        sql`${schema.cultivators.id} = ${buyerCultivatorId} AND ${schema.cultivators.spirit_stones} >= ${price}`,
      )
      .returning({ id: schema.cultivators.id });

    if (!updatedBuyer) {
      // 查询余额以确定错误信息
      const [buyer] = await tx
        .select({ money: schema.cultivators.spirit_stones })
        .from(schema.cultivators)
        .where(eq(schema.cultivators.id, buyerCultivatorId))
        .limit(1);

      if (buyer) {
        throw new AuctionServiceError(
          AuctionError.INSUFFICIENT_FUNDS,
          `囊中羞涩，灵石不足 (需 ${price}，余 ${buyer.money})`,
        );
      }
      throw new AuctionServiceError(
        AuctionError.LISTING_NOT_FOUND,
        '道友查无此人，请重新登录',
      );
    }

    // 5.2 原子扣减货单数量，仅成功扣减的请求可以继续创建交易邮件。
    const sold = await auctionRepository.consumeListingQuantity(
      tx,
      listingId,
      quantity,
    );
    if (!sold) {
      throw new AuctionServiceError(
        AuctionError.LISTING_NOT_FOUND,
        '此物品已下架或售出',
      );
    }

    // 5.3 发送邮件给买家（物品）
    const itemSnapshot = listing.itemSnapshot as
      Material | Artifact | Consumable;
    const purchasedSnapshot =
      listing.itemType === 'artifact'
        ? itemSnapshot
        : { ...itemSnapshot, quantity };
    await MailService.sendMail(
      buyerCultivatorId,
      '拍卖行交易成功',
      `恭喜道友成功购入【${itemSnapshot.name}】，附件为您的战利品。`,
      [
        {
          type: listing.itemType as 'material' | 'artifact' | 'consumable',
          name: itemSnapshot.name,
          quantity,
          data: purchasedSnapshot,
        },
      ],
      'reward',
      tx,
    );

    // 5.4 发送邮件给卖家（扣除手续费后的灵石）
    await MailService.sendMail(
      listing.sellerId,
      '拍卖行物品售出',
      `道友寄售的【${itemSnapshot.name}】成交 ${quantity} 件，成交额 ${price} 灵石，按阶梯税扣除 ${feeAmount} 灵石后获得 ${sellerAmount} 灵石，请收取附件。`,
      [
        {
          type: 'spirit_stones',
          name: '灵石',
          quantity: sellerAmount,
        },
      ],
      'reward',
      tx,
    );
  };

  if (options.tx) {
    await persistPurchase(options.tx);
  } else {
    await getExecutor().transaction(persistPurchase);
  }

  // 6. 清除缓存
  if (!options.deferCacheClear) {
    await clearAuctionListingsCache();
  }
}

/**
 * 下架物品
 */
export async function cancelListing(
  listingId: string,
  cultivatorId: string,
  options: AuctionMutationOptions = {},
): Promise<void> {
  const q = getExecutor(options.tx);
  // 1. 查询拍卖记录（快速前置校验，减少无效事务开销）
  const listing = await auctionRepository.findById(listingId, q);
  if (!listing) {
    throw new AuctionServiceError(AuctionError.LISTING_NOT_FOUND, '拍卖不存在');
  }

  // 2. 前置校验所有权（非事务内，用于快速拒绝）
  if (listing.sellerId !== cultivatorId) {
    throw new AuctionServiceError(AuctionError.NOT_OWNER, '无权操作他人的拍卖');
  }

  // 3. 前置校验状态（非事务内，用于快速拒绝）
  if (listing.status !== 'active') {
    throw new AuctionServiceError(
      AuctionError.LISTING_NOT_FOUND,
      '此物品已售出或下架',
    );
  }

  // 4. 事务：active -> cancelled 条件迁移 + 发送邮件
  const persistCancel = async (tx: DbTransaction) => {
    const cancelled = await auctionRepository.transitionStatus(
      tx,
      listingId,
      'active',
      'cancelled',
      { sellerId: cultivatorId },
    );
    if (!cancelled) {
      throw new AuctionServiceError(
        AuctionError.LISTING_NOT_FOUND,
        '此物品已售出或下架',
      );
    }

    // 发送邮件返还物品
    const itemSnapshot = cancelled.itemSnapshot as
      Material | Artifact | Consumable;
    const itemQuantity = cancelled.remainingQuantity;
    const returnedSnapshot =
      cancelled.itemType === 'artifact'
        ? itemSnapshot
        : { ...itemSnapshot, quantity: itemQuantity };
    await MailService.sendMail(
      cultivatorId,
      '拍卖行物品返还',
      `道友寄售的【${itemSnapshot.name}】已下架，附件返还物品。`,
      [
        {
          type: cancelled.itemType as 'material' | 'artifact' | 'consumable',
          name: itemSnapshot.name,
          quantity: itemQuantity,
          data: returnedSnapshot,
        },
      ],
      'reward',
      tx,
    );
  };

  if (options.tx) {
    await persistCancel(options.tx);
  } else {
    await getExecutor().transaction(persistCancel);
  }

  // 5. 清除缓存
  if (!options.deferCacheClear) {
    await clearAuctionListingsCache();
  }
}

/**
 * 批量处理过期拍卖
 */
export async function expireListings(): Promise<number> {
  const q = getExecutor();
  // 1. 原子更新过期状态并发送邮件
  let processed = 0;

  await q.transaction(async (tx) => {
    const expiredListings = await auctionRepository.markExpiredListings(tx);
    if (expiredListings.length === 0) {
      return;
    }

    // 逐个发送返还邮件
    for (const listing of expiredListings) {
      const itemSnapshot = listing.itemSnapshot as
        Material | Artifact | Consumable;
      const itemQuantity = listing.remainingQuantity;
      const returnedSnapshot =
        listing.itemType === 'artifact'
          ? itemSnapshot
          : { ...itemSnapshot, quantity: itemQuantity };
      await MailService.sendMail(
        listing.sellerId,
        '拍卖行物品过期',
        `道友寄售的【${itemSnapshot.name}】已过期，附件返还物品。`,
        [
          {
            type: listing.itemType as 'material' | 'artifact' | 'consumable',
            name: itemSnapshot.name,
            quantity: itemQuantity,
            data: returnedSnapshot,
          },
        ],
        'reward',
        tx,
      );
      processed++;
    }
  });

  // 2. 清除缓存
  await clearAuctionListingsCache();

  return processed;
}
