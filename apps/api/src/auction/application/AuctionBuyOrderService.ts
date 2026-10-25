import type {
  AuctionBuyOrderCreateRequest,
  AuctionBuyOrderView,
} from '@daoyou/contracts/auction';
import {
  AUCTION_MAX_ACTIVE_BUY_ORDERS,
  AUCTION_MAX_TRANSACTION_TOTAL,
  AuctionMaterialConditionSchema,
  auctionMaterialConditionLabel,
  type AuctionBuyOrderItemType,
} from '@daoyou/game-domain/auction';
import {
  MaterialFactsSchema,
  SeedFactsSchema,
} from '@daoyou/game-domain/inventory';
import {
  AuctionSnapshotSchema,
  auctionBuyOrderMatchesItem,
  auctionBuyOrderTargetBlockReason,
  auctionBuyOrderTargetStackKey,
  auctionItemCategory,
  auctionItemPriceCap,
  auctionItemQuality,
  auctionListingStackLimit,
  auctionMaterialConditionBlockReason,
  auctionMaterialConditionMatches,
  auctionSellerReceiptAllows,
  calculateAuctionSettlement,
  getAuctionUnitPriceCap,
} from '@daoyou/game-rules/auction';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import { inventoryStackIdentity } from '@daoyou/game-rules/inventory/stacking';
import {
  assertInventoryIdle,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from '@server/inventory/operations.js';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import * as auctionBuyOrderRepository from '@server/lib/repositories/auctionBuyOrderRepository.js';
import { findById as findListingById } from '@server/lib/repositories/auctionRepository.js';
import { publicMailAttachment } from '@server/mail/attachments.js';
import type { MailDeliveryService } from '@server/mail/mail-delivery.service.js';
import { and, eq, sql } from 'drizzle-orm';
import type { AuctionMutationOptions } from './AuctionService.js';
import { AuctionServiceError } from './AuctionService.js';

type AuctionBuyOrder = auctionBuyOrderRepository.AuctionBuyOrder;
type SupplyableItem = { id: string; quantity: number; revision: number };

const AUCTION_BUY_ORDER_TTL_MS = 48 * 60 * 60 * 1000;

function stackLookupKey(definitionId: string, stackKey: string) {
  return `${definitionId}\u0000${stackKey}`;
}

function targetName(definitionId: string, instanceData: unknown) {
  const definition = itemDefinition(definitionId);
  if (definition.kind === 'seed')
    return SeedFactsSchema.parse(instanceData).name;
  return (
    (instanceData as { name?: string } | null)?.name ?? definition.name
  );
}

function targetSnapshotOf(definitionId: string, instanceData: unknown) {
  return {
    version: 'inventory_v1' as const,
    item: {
      definitionId,
      quantity: 1,
      ...(instanceData === null || instanceData === undefined
        ? {}
        : { instanceData }),
    },
  };
}

export function publicAuctionBuyOrder(
  order: AuctionBuyOrder,
  supplyableItems: SupplyableItem[] = [],
): AuctionBuyOrderView {
  const base = {
    id: order.id,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    itemType: order.itemType as AuctionBuyOrderItemType,
    itemName: order.itemName,
    itemQuality: order.itemQuality,
    itemCategory: order.itemCategory,
    price: order.price,
    initialQuantity: order.initialQuantity,
    remainingQuantity: order.remainingQuantity,
    expiresAt: order.expiresAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    supplyableQuantity: supplyableItems.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    supplyableItems,
  };
  if (order.targetMode === 'condition') {
    const condition = AuctionMaterialConditionSchema.safeParse(
      order.targetConditions,
    );
    if (!condition.success)
      throw new AuctionServiceError('INVALID_TARGET', '收购条件无效');
    return {
      ...base,
      targetMode: 'condition',
      condition: condition.data,
      item: null,
    };
  }
  const snapshot = AuctionSnapshotSchema.safeParse(order.targetSnapshot);
  if (!snapshot.success || snapshot.data.version !== 'inventory_v1')
    throw new AuctionServiceError('INVALID_TARGET', '收购单快照无效');
  const attachment = publicMailAttachment({
    type: 'inventory_v1',
    name: order.itemName,
    quantity: 1,
    inventory: { ...snapshot.data.item, quantity: 1 },
  });
  if (!attachment.inventory)
    throw new AuctionServiceError('INVALID_TARGET', '收购单快照无效');
  return {
    ...base,
    targetMode: 'exact',
    condition: null,
    item: {
      name: order.itemName,
      definitionId: attachment.inventory.definitionId,
      instanceData: attachment.inventory.instanceData ?? null,
      quantity: order.remainingQuantity,
    },
  };
}

export interface AuctionBuyOrderListOptions {
  scope?: 'all' | 'mine';
  itemType?: AuctionBuyOrderItemType;
  itemCategory?: string;
  itemQuality?: string;
  itemName?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_desc' | 'latest';
  page?: number;
  limit?: number;
}

export class AuctionBuyOrderOperations {
  constructor(
    private readonly database: DbClient,
    private readonly mail: MailDeliveryService,
  ) {}

  private async bagSupplyCandidates(owner: string) {
    const rows = await this.database
      .select()
      .from(schema.inventoryItems)
      .where(
        and(
          eq(schema.inventoryItems.cultivatorId, owner),
          eq(schema.inventoryItems.location, 'bag'),
        ),
      );
    const candidates: (SupplyableItem & {
      definitionId: string;
      instanceData: unknown;
    })[] = [];
    for (const row of rows) {
      try {
        const item = inventoryItemOf(row);
        candidates.push({
          id: item.id,
          quantity: item.quantity,
          revision: item.revision,
          definitionId: item.definitionId,
          instanceData: item.instanceData ?? null,
        });
      } catch {
        continue;
      }
    }
    return candidates;
  }

  private exactSupplyByStackKey(
    candidates: (SupplyableItem & {
      definitionId: string;
      instanceData: unknown;
    })[],
  ) {
    const map = new Map<string, SupplyableItem[]>();
    for (const item of candidates) {
      let stackKey: string | null;
      try {
        stackKey = inventoryStackIdentity(item.definitionId, item.instanceData);
      } catch {
        continue;
      }
      if (!stackKey) continue;
      const key = stackLookupKey(item.definitionId, stackKey);
      const items = map.get(key) ?? [];
      items.push({
        id: item.id,
        quantity: item.quantity,
        revision: item.revision,
      });
      map.set(key, items);
    }
    return map;
  }

  async listBuyOrders(owner: string, options: AuctionBuyOrderListOptions) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const result = await auctionBuyOrderRepository.findActiveBuyOrders(
      { ...options, page, limit, viewerCultivatorId: owner },
      this.database,
    );
    const candidates =
      options.scope === 'mine' ? [] : await this.bagSupplyCandidates(owner);
    const exactSupply = this.exactSupplyByStackKey(candidates);
    const totalPages = Math.ceil(result.total / limit);
    const slots =
      options.scope === 'mine'
        ? {
            used: await auctionBuyOrderRepository.countActiveByBuyer(
              owner,
              this.database,
            ),
            limit: AUCTION_MAX_ACTIVE_BUY_ORDERS,
          }
        : undefined;
    return {
      orders: result.orders.map((order) => {
        if (order.targetMode === 'condition') {
          const condition = AuctionMaterialConditionSchema.safeParse(
            order.targetConditions,
          );
          const supplyable = condition.success
            ? candidates
                .filter((item) =>
                  auctionMaterialConditionMatches(condition.data, item),
                )
                .map(({ id, quantity, revision }) => ({
                  id,
                  quantity,
                  revision,
                }))
            : [];
          return publicAuctionBuyOrder(order, supplyable);
        }
        const supplyable = order.targetStackKey
          ? (exactSupply.get(
              stackLookupKey(order.targetDefinitionId, order.targetStackKey),
            ) ?? [])
          : [];
        return publicAuctionBuyOrder(order, supplyable);
      }),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
      ...(slots ? { slots } : {}),
    };
  }

  private async resolveTarget(
    source: NonNullable<AuctionBuyOrderCreateRequest['source']>,
    buyerCultivatorId: string,
    tx: DbTransaction,
  ): Promise<{ definitionId: string; instanceData: unknown }> {
    if (source.kind === 'bag') {
      const [row] = await tx
        .select()
        .from(schema.inventoryItems)
        .where(
          and(
            eq(schema.inventoryItems.id, source.itemId),
            eq(schema.inventoryItems.cultivatorId, buyerCultivatorId),
            eq(schema.inventoryItems.location, 'bag'),
          ),
        )
        .limit(1);
      if (!row || row.revision !== source.revision)
        throw new AuctionServiceError(
          'ITEM_CHANGED',
          '物品已变化，请重新选择收购目标',
        );
      const item = inventoryItemOf(row);
      return {
        definitionId: item.definitionId,
        instanceData: item.instanceData ?? null,
      };
    }
    const listing = await findListingById(source.listingId, tx);
    if (
      !listing ||
      listing.status !== 'active' ||
      listing.expiresAt.getTime() <= Date.now()
    )
      throw new AuctionServiceError('LISTING_NOT_FOUND', '货单已下架或售出');
    if (
      listing.visibility === 'private' &&
      listing.targetCultivatorId !== buyerCultivatorId &&
      listing.sellerId !== buyerCultivatorId
    )
      throw new AuctionServiceError('LISTING_NOT_FOUND', '货单不可见');
    const snapshot = AuctionSnapshotSchema.parse(listing.itemSnapshot);
    if (snapshot.version !== 'inventory_v1')
      throw new AuctionServiceError('INVALID_TARGET', '该货单不支持收购同款');
    return {
      definitionId: snapshot.item.definitionId,
      instanceData: snapshot.item.instanceData ?? null,
    };
  }

  async createBuyOrder(
    input: AuctionBuyOrderCreateRequest & {
      buyerCultivatorId: string;
      buyerCultivatorName: string;
    },
    options: AuctionMutationOptions = {},
  ) {
    const persist = async (tx: DbTransaction) => {
      if (
        (await auctionBuyOrderRepository.countActiveByBuyer(
          input.buyerCultivatorId,
          tx,
        )) >= AUCTION_MAX_ACTIVE_BUY_ORDERS
      )
        throw new AuctionServiceError(
          'MAX_BUY_ORDERS',
          `收购位已满（最多${AUCTION_MAX_ACTIVE_BUY_ORDERS}个）`,
        );
      const targetMode = input.targetMode;
      let targetDefinitionId: string;
      let targetStackKey: string | null;
      let targetSnapshot: unknown | null;
      let targetConditions: unknown | null;
      let itemName: string;
      let itemQuality: string;
      let itemCategory: string;
      let quantityLimit: number;
      let priceCap: number;
      if (targetMode === 'condition') {
        if (!input.condition)
          throw new AuctionServiceError(
            'INVALID_TARGET',
            '条件收购必须提供收购条件',
          );
        const blocked = auctionMaterialConditionBlockReason(input.condition);
        if (blocked)
          throw new AuctionServiceError('INVALID_TARGET', blocked);
        targetDefinitionId = 'material.v1';
        targetStackKey = null;
        targetSnapshot = null;
        targetConditions = input.condition;
        itemName = auctionMaterialConditionLabel(input.condition);
        itemQuality = input.condition.quality;
        itemCategory = input.condition.type ?? 'material';
        quantityLimit = auctionListingStackLimit(targetDefinitionId);
        priceCap = getAuctionUnitPriceCap(input.condition.quality);
      } else {
        if (!input.source)
          throw new AuctionServiceError(
            'INVALID_TARGET',
            '直接收购必须选择收购目标',
          );
        const target = await this.resolveTarget(
          input.source,
          input.buyerCultivatorId,
          tx,
        );
        const blocked = auctionBuyOrderTargetBlockReason(target);
        if (blocked) throw new AuctionServiceError('INVALID_TARGET', blocked);
        const stackKey = auctionBuyOrderTargetStackKey(target);
        if (!stackKey)
          throw new AuctionServiceError('INVALID_TARGET', '该物品不支持收购');
        targetDefinitionId = target.definitionId;
        targetStackKey = stackKey;
        targetSnapshot = targetSnapshotOf(
          target.definitionId,
          target.instanceData,
        );
        targetConditions = null;
        itemName = targetName(target.definitionId, target.instanceData);
        itemQuality = auctionItemQuality(target) ?? '';
        itemCategory = auctionItemCategory(target);
        quantityLimit = auctionListingStackLimit(target.definitionId);
        priceCap = auctionItemPriceCap(target);
      }
      const definition = itemDefinition(targetDefinitionId);
      if (input.quantity > quantityLimit)
        throw new AuctionServiceError(
          'INVALID_QUANTITY',
          targetMode === 'condition'
            ? '收购数量不能超过材料堆叠上限'
            : '收购数量不能超过该物品的堆叠上限',
        );
      if (input.price > priceCap)
        throw new AuctionServiceError(
          'INVALID_PRICE',
          '该收购单价不得超过 ' + priceCap.toLocaleString() + ' 灵石',
        );
      const grossAmount = input.price * input.quantity;
      if (grossAmount > AUCTION_MAX_TRANSACTION_TOTAL)
        throw new AuctionServiceError(
          'INVALID_PRICE',
          '单笔收购总额不得超过 ' +
            AUCTION_MAX_TRANSACTION_TOTAL.toLocaleString() +
            ' 灵石',
        );
      if (!auctionSellerReceiptAllows(input.price, input.quantity))
        throw new AuctionServiceError(
          'INVALID_QUANTITY',
          '收购数量过多，请分单发布',
        );
      const [paid] = await tx
        .update(schema.cultivators)
        .set({
          spirit_stones: sql`${schema.cultivators.spirit_stones} - ${grossAmount}`,
        })
        .where(
          and(
            eq(schema.cultivators.id, input.buyerCultivatorId),
            sql`${schema.cultivators.spirit_stones} >= ${grossAmount}`,
          ),
        )
        .returning({ id: schema.cultivators.id });
      if (!paid)
        throw new AuctionServiceError('INSUFFICIENT_FUNDS', '灵石不足');
      const order = await auctionBuyOrderRepository.createBuyOrder(
        {
          buyerId: input.buyerCultivatorId,
          buyerName: input.buyerCultivatorName,
          targetMode,
          itemType: definition.kind as AuctionBuyOrderItemType,
          itemName,
          itemQuality,
          itemCategory,
          targetDefinitionId,
          targetStackKey,
          targetSnapshot,
          targetConditions,
          price: input.price,
          quantity: input.quantity,
          expiresAt: new Date(Date.now() + AUCTION_BUY_ORDER_TTL_MS),
        },
        tx,
      );
      return {
        buyOrderId: order.id,
        frozenAmount: grossAmount,
        message: '收购单已发布',
      };
    };
    if (options.tx) return persist(options.tx);
    return this.database.transaction(persist);
  }

  async supplyBuyOrder(
    input: {
      buyOrderId: string;
      sellerCultivatorId: string;
      itemId: string;
      revision: number;
      quantity: number;
    },
    options: AuctionMutationOptions = {},
  ) {
    const persist = async (tx: DbTransaction) => {
      const order = await auctionBuyOrderRepository.findById(
        input.buyOrderId,
        tx,
      );
      if (!order || order.status !== 'active')
        throw new AuctionServiceError(
          'BUY_ORDER_NOT_FOUND',
          '此收购单已完成、取消或过期',
        );
      if (order.expiresAt.getTime() <= Date.now())
        throw new AuctionServiceError('BUY_ORDER_EXPIRED', '收购单已过期');
      if (input.quantity > order.remainingQuantity)
        throw new AuctionServiceError(
          'INVALID_QUANTITY',
          '供货数量超过收购剩余数量',
        );
      const [buyer] = await tx
        .select({ userId: schema.cultivators.userId })
        .from(schema.cultivators)
        .where(eq(schema.cultivators.id, order.buyerId));
      const [seller] = await tx
        .select({ userId: schema.cultivators.userId })
        .from(schema.cultivators)
        .where(eq(schema.cultivators.id, input.sellerCultivatorId));
      if (buyer && seller && buyer.userId === seller.userId)
        throw new AuctionServiceError(
          'SAME_OWNER',
          '不可与自己账号下的角色进行交易',
        );
      const { grossAmount, feeAmount, sellerAmount } =
        calculateAuctionSettlement(order.price, input.quantity);
      if (!auctionSellerReceiptAllows(order.price, input.quantity))
        throw new AuctionServiceError(
          'INVALID_QUANTITY',
          '单次供货件数过多，请分次供货',
        );
      await assertInventoryIdle(input.sellerCultivatorId, tx);
      const before = (
        await tx
          .select()
          .from(schema.inventoryItems)
          .where(
            and(
              eq(
                schema.inventoryItems.cultivatorId,
                input.sellerCultivatorId,
              ),
              eq(schema.inventoryItems.location, 'bag'),
            ),
          )
      ).map(inventoryItemOf);
      const item = before.find((row) => row.id === input.itemId);
      if (!item || item.revision !== input.revision)
        throw new InventoryError('物品已变化，请刷新');
      if (item.quantity < input.quantity)
        throw new InventoryError('物品数量不足');
      const conditionResult =
        order.targetMode === 'condition'
          ? AuctionMaterialConditionSchema.safeParse(order.targetConditions)
          : null;
      if (conditionResult && !conditionResult.success)
        throw new AuctionServiceError('INVALID_TARGET', '收购条件无效');
      const condition = conditionResult?.success
        ? conditionResult.data
        : null;
      if (condition) {
        if (!auctionMaterialConditionMatches(condition, item))
          throw new AuctionServiceError(
            'ITEM_MISMATCH',
            '该物品不符合收购条件',
          );
      } else if (
        !order.targetStackKey ||
        !auctionBuyOrderMatchesItem(
          {
            definitionId: order.targetDefinitionId,
            stackKey: order.targetStackKey,
          },
          item,
        )
      )
        throw new AuctionServiceError(
          'ITEM_MISMATCH',
          '该物品与收购目标不一致',
        );
      const consumed = await auctionBuyOrderRepository.consumeBuyOrderQuantity(
        tx,
        order.id,
        input.quantity,
      );
      if (!consumed)
        throw new AuctionServiceError(
          'BUY_ORDER_NOT_FOUND',
          '收购单已变化，请刷新',
        );
      await saveInventoryPlan(
        input.sellerCultivatorId,
        before,
        before.flatMap((row) =>
          row.id !== item.id
            ? [row]
            : row.quantity === input.quantity
              ? []
              : [
                  {
                    ...row,
                    quantity: row.quantity - input.quantity,
                    revision: row.revision + 1,
                  },
                ],
        ),
        tx,
      );
      const deliveredFacts = condition
        ? MaterialFactsSchema.parse(item.instanceData)
        : null;
      const deliveredName = deliveredFacts?.name ?? order.itemName;
      const deliveredItem = deliveredFacts
        ? {
            definitionId: item.definitionId,
            quantity: 1,
            instanceData: deliveredFacts,
          }
        : (() => {
            const snapshot = AuctionSnapshotSchema.safeParse(
              order.targetSnapshot,
            );
            if (!snapshot.success || snapshot.data.version !== 'inventory_v1')
              throw new AuctionServiceError(
                'INVALID_TARGET',
                '收购单快照无效',
              );
            return snapshot.data.item;
          })();
      await this.mail.send(
        order.buyerId,
        '拍卖行收购成交',
        '已收到【' +
          deliveredName +
          '】' +
          input.quantity +
          '件，请领取附件。',
        [
          {
            type: 'inventory_v1',
            name: deliveredName,
            quantity: input.quantity,
            inventory: {
              ...deliveredItem,
              quantity: input.quantity,
            },
          },
        ],
        'reward',
        tx,
      );
      await this.mail.send(
        input.sellerCultivatorId,
        '拍卖行收购交付',
        '【' +
          deliveredName +
          '】交付' +
          input.quantity +
          '件，成交额' +
          grossAmount +
          '灵石，税费' +
          feeAmount +
          '灵石，实得' +
          sellerAmount +
          '灵石。',
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
      return {
        filledQuantity: input.quantity,
        remainingQuantity: consumed.remainingQuantity,
        status: consumed.status,
        message: '供货成功，请查收邮件',
      };
    };
    if (options.tx) return persist(options.tx);
    return this.database.transaction(persist);
  }

  async cancelBuyOrder(
    input: { buyOrderId: string; buyerCultivatorId: string },
    options: AuctionMutationOptions = {},
  ) {
    const persist = async (tx: DbTransaction) => {
      const cancelled = await auctionBuyOrderRepository.transitionStatus(
        tx,
        input.buyOrderId,
        'active',
        'cancelled',
        { buyerId: input.buyerCultivatorId },
      );
      if (!cancelled)
        throw new AuctionServiceError(
          'BUY_ORDER_NOT_FOUND',
          '收购单不存在、已结束或不属于你',
        );
      const refund = cancelled.remainingQuantity * cancelled.price;
      if (refund > 0)
        await this.mail.send(
          input.buyerCultivatorId,
          '拍卖行收购取消',
          '【' + cancelled.itemName + '】收购单已取消，冻结灵石退回附件。',
          [{ type: 'spirit_stones', name: '灵石', quantity: refund }],
          'reward',
          tx,
        );
      return { message: '收购单已取消，冻结灵石将通过邮件退回' };
    };
    if (options.tx) return persist(options.tx);
    return this.database.transaction(persist);
  }

  async expireBuyOrders() {
    return this.database.transaction(async (tx) => {
      const expired =
        await auctionBuyOrderRepository.markExpiredBuyOrders(tx);
      for (const order of expired) {
        const refund = order.remainingQuantity * order.price;
        if (refund <= 0) continue;
        await this.mail.send(
          order.buyerId,
          '拍卖行收购过期',
          '【' + order.itemName + '】收购单已过期，冻结灵石退回附件。',
          [{ type: 'spirit_stones', name: '灵石', quantity: refund }],
          'reward',
          tx,
        );
      }
      return expired.length;
    });
  }
}
