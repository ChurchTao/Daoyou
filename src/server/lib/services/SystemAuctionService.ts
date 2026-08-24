import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import * as auctionRepository from '@server/lib/repositories/auctionRepository';
import {
  getSystemAuctionUnitPrice,
  SYSTEM_AUCTION_CULTIVATOR_ID,
  SYSTEM_AUCTION_LISTING_DURATION_MS,
  SYSTEM_AUCTION_QUALITIES,
  SYSTEM_AUCTION_REFRESH_INTERVAL_MS,
  SYSTEM_AUCTION_RESTORE_RATE_BY_QUALITY,
  SYSTEM_AUCTION_SELLER_NAME,
  SYSTEM_AUCTION_STOCK_BY_QUALITY,
  SYSTEM_AUCTION_USER_ID,
  type SystemAuctionQuality,
} from '@shared/config/systemAuctionConfig';
import { MARKET_PRESET_POOL } from '@shared/engine/material/creation/marketPresets';
import { getMaterialTypeLabel } from '@shared/lib/gameConceptDisplay';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { ConditionOperation, PillFamily } from '@shared/types/consumable';
import type { Consumable, Material } from '@shared/types/cultivator';
import { randomUUID } from 'node:crypto';

type ListingSeed = auctionRepository.CreateAuctionListingData;

/** Bun cron 偶尔会在整点前数毫秒触发；将其归入即将开始的新批次。 */
const SYSTEM_AUCTION_BUCKET_BOUNDARY_GRACE_MS = 5_000;

const QUALITY_FLAVOR: Record<Quality, string> = {
  凡品: '素炼',
  灵品: '蕴灵',
  玄品: '玄元',
  真品: '真灵',
  地品: '地脉',
  天品: '九霄',
  仙品: '太虚',
  神品: '太初',
};

const PILL_TEMPLATES: Array<{
  family: PillFamily;
  name: string;
  resource?: 'hp' | 'mp';
}> = [
  { family: 'healing', name: '回春丹', resource: 'hp' },
  { family: 'mana', name: '蕴灵丹', resource: 'mp' },
  { family: 'cultivation', name: '凝元丹' },
];

const CULTIVATION_EXP_BY_QUALITY: Record<Quality, number> = {
  凡品: 10,
  灵品: 25,
  玄品: 50,
  真品: 100,
  地品: 200,
  天品: 400,
  仙品: 800,
  神品: 1_600,
};

function rotate<T>(values: readonly T[], offset: number): T[] {
  return values.map((_, index) => values[(index + offset) % values.length]!);
}

function buildMaterial(
  quality: SystemAuctionQuality,
  materialType: MaterialType,
  quantity: number,
  bucketOrdinal: number,
): Material {
  const presets = (
    MARKET_PRESET_POOL[materialType] as Partial<
      Record<
        Quality,
        Array<{ name: string; description: string; element: ElementType }>
      >
    >
  )[quality];
  const preset = presets?.[bucketOrdinal % presets.length];
  const fallbackName = `${QUALITY_FLAVOR[quality]}${getMaterialTypeLabel(materialType)}`;
  const unitPrice = getSystemAuctionUnitPrice({
    itemType: 'material',
    quality,
    materialType,
  });

  return {
    id: randomUUID(),
    name: preset?.name ?? fallbackName,
    type: materialType,
    rank: quality,
    price: unitPrice,
    element:
      preset?.element ?? ELEMENT_VALUES[bucketOrdinal % ELEMENT_VALUES.length]!,
    description:
      preset?.description ??
      `天道商会收拢的${quality}${getMaterialTypeLabel(materialType)}，可用于对应的炼制与参悟。`,
    details: { source: 'system-auction' },
    quantity,
  };
}

function buildConsumable(
  quality: SystemAuctionQuality,
  quantity: number,
  templateIndex: number,
): Consumable {
  const template = PILL_TEMPLATES[templateIndex % PILL_TEMPLATES.length]!;
  const name = `${QUALITY_FLAVOR[quality]}${template.name}`;
  const primaryOperation: ConditionOperation = template.resource
    ? {
        type: 'restore_resource',
        resource: template.resource,
        mode: 'percent',
        value: SYSTEM_AUCTION_RESTORE_RATE_BY_QUALITY[quality],
      }
    : {
        type: 'gain_progress',
        target: 'cultivation_exp',
        value: CULTIVATION_EXP_BY_QUALITY[quality],
      };
  const operations: ConditionOperation[] = [primaryOperation];

  return {
    id: randomUUID(),
    name,
    type: '丹药',
    quality,
    quantity,
    description:
      template.family === 'cultivation'
        ? `服用后增加 ${CULTIVATION_EXP_BY_QUALITY[quality]} 点修为。`
        : `服用后恢复 ${Math.round(SYSTEM_AUCTION_RESTORE_RATE_BY_QUALITY[quality] * 100)}% 的${template.resource === 'hp' ? '气血' : '法力'}。`,
    spec: {
      kind: 'pill',
      family: template.family,
      operations,
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory:
          template.family === 'cultivation' ? 'cultivation' : 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['天道商会制式灵材'],
        stability: 90,
        toxicityRating: 0,
        tags: ['system-auction', template.family],
        version: 4,
      },
    },
  };
}

function toListing(args: {
  itemType: 'material' | 'consumable';
  item: Material | Consumable;
  quality: SystemAuctionQuality;
  quantity: number;
  category: string;
  price: number;
  expiresAt: Date;
}): ListingSeed {
  return {
    sellerId: SYSTEM_AUCTION_CULTIVATOR_ID,
    sellerName: SYSTEM_AUCTION_SELLER_NAME,
    itemType: args.itemType,
    itemId: args.item.id!,
    itemName: args.item.name,
    itemQuality: args.quality,
    itemCategory: args.category,
    itemSnapshot: args.item,
    price: args.price,
    initialQuantity: args.quantity,
    remainingQuantity: args.quantity,
    expiresAt: args.expiresAt,
  };
}

function buildListingSeeds(scheduledAt: Date, expiresAt: Date): ListingSeed[] {
  const bucketOrdinal = Math.floor(
    scheduledAt.getTime() / SYSTEM_AUCTION_REFRESH_INTERVAL_MS,
  );
  const listings: ListingSeed[] = [];

  for (const [qualityIndex, quality] of SYSTEM_AUCTION_QUALITIES.entries()) {
    const stock = SYSTEM_AUCTION_STOCK_BY_QUALITY[quality];
    const materialTypes = rotate(
      MATERIAL_TYPE_VALUES,
      bucketOrdinal + qualityIndex,
    ).slice(0, stock.materialListings);
    for (const [index, materialType] of materialTypes.entries()) {
      const material = buildMaterial(
        quality,
        materialType,
        stock.materialQuantity,
        bucketOrdinal + index,
      );
      listings.push(
        toListing({
          itemType: 'material',
          item: material,
          quality,
          quantity: stock.materialQuantity,
          category: material.type,
          price: getSystemAuctionUnitPrice({
            itemType: 'material',
            quality,
            materialType,
          }),
          expiresAt,
        }),
      );
    }

    for (let index = 0; index < stock.consumableListings; index += 1) {
      const consumable = buildConsumable(
        quality,
        stock.consumableQuantity,
        bucketOrdinal + qualityIndex + index,
      );
      listings.push(
        toListing({
          itemType: 'consumable',
          item: consumable,
          quality,
          quantity: stock.consumableQuantity,
          category: consumable.type,
          price: getSystemAuctionUnitPrice({
            itemType: 'consumable',
            quality,
          }),
          expiresAt,
        }),
      );
    }
  }

  return listings;
}

async function ensureSystemSeller(tx: DbTransaction): Promise<void> {
  await tx
    .insert(cultivators)
    .values({
      id: SYSTEM_AUCTION_CULTIVATOR_ID,
      userId: SYSTEM_AUCTION_USER_ID,
      name: SYSTEM_AUCTION_SELLER_NAME,
      prompt: '系统拍卖行公共货源',
      realm: '炼气',
      realm_stage: '初期',
      status: 'system',
      vitality: 10,
      strength: 10,
      spirit: 10,
      endurance: 10,
      speed: 10,
      willpower: 10,
    })
    .onConflictDoUpdate({
      target: cultivators.id,
      set: {
        name: SYSTEM_AUCTION_SELLER_NAME,
        status: 'system',
      },
    });
}

export interface SystemAuctionRefreshResult {
  created: number;
  expired: number;
  skipped: boolean;
  bucketStartedAt: string;
}

export interface SystemAuctionRefreshOptions {
  force?: boolean;
}

export async function refreshSystemAuctionListings(
  scheduledAt = new Date(),
  options: SystemAuctionRefreshOptions = {},
): Promise<SystemAuctionRefreshResult> {
  const bucketReferenceTime =
    scheduledAt.getTime() + SYSTEM_AUCTION_BUCKET_BOUNDARY_GRACE_MS;
  const bucketStartedAt = new Date(
    Math.floor(bucketReferenceTime / SYSTEM_AUCTION_REFRESH_INTERVAL_MS) *
      SYSTEM_AUCTION_REFRESH_INTERVAL_MS,
  );
  const stockedSince = new Date(
    bucketStartedAt.getTime() - SYSTEM_AUCTION_BUCKET_BOUNDARY_GRACE_MS,
  );
  const result = await getExecutor().transaction(async (tx) => {
    await ensureSystemSeller(tx);
    const existing = await auctionRepository.countBySellerSince(
      SYSTEM_AUCTION_CULTIVATOR_ID,
      stockedSince,
      tx,
    );
    if (!options.force && existing > 0) {
      return {
        created: 0,
        expired: 0,
        skipped: true,
        bucketStartedAt: bucketStartedAt.toISOString(),
      };
    }

    const expired = await auctionRepository.expireActiveBySeller(
      tx,
      SYSTEM_AUCTION_CULTIVATOR_ID,
    );
    const expiresAt = new Date(
      scheduledAt.getTime() + SYSTEM_AUCTION_LISTING_DURATION_MS,
    );
    const listings = buildListingSeeds(scheduledAt, expiresAt);
    const created = await auctionRepository.createListings(tx, listings);
    return {
      created: created.length,
      expired,
      skipped: false,
      bucketStartedAt: bucketStartedAt.toISOString(),
    };
  });

  if (!result.skipped) {
    const { clearAuctionListingsCache } = await import('./AuctionService');
    await clearAuctionListingsCache();
  }
  return result;
}
