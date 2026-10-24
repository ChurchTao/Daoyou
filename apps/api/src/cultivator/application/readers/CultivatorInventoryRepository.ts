import { ELEMENT_VALUES, ElementType } from '@daoyou/constants/elements';
import { MaterialType } from '@daoyou/game-domain/inventory';
import { Quality } from '@daoyou/constants/qualities';
import type {
  Consumable,
  Cultivator,
} from '@daoyou/game-domain/character';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import { consumeBagConsumable, getBagConsumable } from '@server/inventory/application/BagConsumables.js';
import { mapConsumableRow } from '@server/inventory/application/consumablePersistence.js';
import { toArtifactFromProduct } from '@server/legacy-items/application/creationProductArtifactSupport.js';
import { sanitizeMaterialDetails } from '@server/inventory/application/materialDetailsPrivacy.js';

import { assertCultivatorOwnership } from '@server/cultivator/application/readers/CultivatorStateRepository.js';

type InventoryType = 'artifacts' | 'consumables' | 'materials';

type InventoryItemByType = {
  artifacts: Cultivator['inventory']['artifacts'][number];
  consumables: Cultivator['inventory']['consumables'][number];
  materials: Cultivator['inventory']['materials'][number];
};

interface InventoryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedInventoryResult<T extends InventoryType> {
  items: InventoryItemByType[T][];
  pagination: InventoryPagination;
}

export type MaterialInventorySortBy =
  'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name';

export type MaterialInventorySortOrder = 'asc' | 'desc';

export function mapArtifactRow(
  a: ReturnType<typeof toArtifactFromProduct>,
): Cultivator['inventory']['artifacts'][number] {
  return a;
}

export function mapMaterialRow(
  m: typeof schema.materials.$inferSelect,
  options: { includeSeedSpec?: boolean } = {},
): Cultivator['inventory']['materials'][number] {
  return {
    id: m.id,
    name: m.name,
    type: m.type as MaterialType,
    rank: m.rank as Quality,
    element: ELEMENT_VALUES.includes(m.element as ElementType)
      ? (m.element as ElementType)
      : undefined,
    description: m.description || '',
    details: options.includeSeedSpec
      ? ((m.details ?? undefined) as Record<string, unknown> | undefined)
      : sanitizeMaterialDetails(m.details),
    quantity: m.quantity,
  };
}

export async function getCultivatorConsumableById(
  cultivatorId: string,
  consumableId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<Consumable | null> {
  return getBagConsumable(cultivatorId, consumableId, executor);
}

export async function getPaginatedInventoryByType<T extends InventoryType>(
  userId: string,
  cultivatorId: string,
  options: {
    type: T;
    page?: number;
    pageSize?: number;
    materialTypes?: MaterialType[];
    excludeMaterialTypes?: MaterialType[];
    materialRanks?: Quality[];
    materialElements?: ElementType[];
    materialSortBy?: MaterialInventorySortBy;
    materialSortOrder?: MaterialInventorySortOrder;
    consumableKind?: 'pill';
  },
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<PaginatedInventoryResult<T>> {
  await assertCultivatorOwnership(userId, cultivatorId, q);

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
  const offset = (page - 1) * pageSize;

  if (options.type === 'artifacts') {
    const countResult = await q
      .select({ count: sql<number>`count(*)` })
      .from(schema.creationProducts)
      .where(
        and(
          eq(schema.creationProducts.cultivatorId, cultivatorId),
          eq(schema.creationProducts.productType, 'artifact'),
        ),
      );
    const total = Number(countResult[0]?.count || 0);

    const rows = await q
      .select()
      .from(schema.creationProducts)
      .where(
        and(
          eq(schema.creationProducts.cultivatorId, cultivatorId),
          eq(schema.creationProducts.productType, 'artifact'),
        ),
      )
      .orderBy(
        desc(schema.creationProducts.createdAt),
        desc(schema.creationProducts.id),
      )
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize);
    return {
      items: rows.map((artifact) =>
        mapArtifactRow(toArtifactFromProduct(artifact)),
      ) as InventoryItemByType[T][],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  if (options.type === 'consumables') {
    const consumableWhere =
      options.consumableKind === 'pill'
        ? and(
            eq(schema.consumables.cultivatorId, cultivatorId),
            sql`${schema.consumables.spec}->>'kind' = 'pill'`,
          )
        : eq(schema.consumables.cultivatorId, cultivatorId);
    const countResult = await q
      .select({ count: sql<number>`count(*)` })
      .from(schema.consumables)
      .where(consumableWhere);
    const total = Number(countResult[0]?.count || 0);

    const rows = await q
      .select()
      .from(schema.consumables)
      .where(consumableWhere)
      .orderBy(desc(schema.consumables.createdAt), desc(schema.consumables.id))
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize);
    return {
      items: rows.map(mapConsumableRow) as InventoryItemByType[T][],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  const materialConditions: SQL[] = [
    eq(schema.materials.cultivatorId, cultivatorId) as unknown as SQL,
  ];
  if (options.materialTypes && options.materialTypes.length > 0) {
    materialConditions.push(
      inArray(schema.materials.type, options.materialTypes) as unknown as SQL,
    );
  }
  if (options.excludeMaterialTypes && options.excludeMaterialTypes.length > 0) {
    materialConditions.push(
      notInArray(
        schema.materials.type,
        options.excludeMaterialTypes,
      ) as unknown as SQL,
    );
  }
  if (options.materialRanks && options.materialRanks.length > 0) {
    materialConditions.push(
      inArray(schema.materials.rank, options.materialRanks) as unknown as SQL,
    );
  }
  if (options.materialElements && options.materialElements.length > 0) {
    materialConditions.push(
      inArray(
        schema.materials.element,
        options.materialElements,
      ) as unknown as SQL,
    );
  }
  const materialWhere =
    materialConditions.length === 1
      ? materialConditions[0]
      : and(...materialConditions)!;

  const sortBy = options.materialSortBy ?? 'createdAt';
  const sortOrder = options.materialSortOrder ?? 'desc';
  const [countResult] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.materials)
    .where(materialWhere);
  const total = Number(countResult?.count ?? 0);
  const sortExpression =
    sortBy === 'rank'
      ? sql<number>`case ${schema.materials.rank}
          when '凡品' then 0
          when '灵品' then 1
          when '玄品' then 2
          when '真品' then 3
          when '地品' then 4
          when '天品' then 5
          when '仙品' then 6
          when '神品' then 7
          else -1
        end`
      : sortBy === 'type'
        ? sql`${schema.materials.type}`
        : sortBy === 'element'
          ? sql`coalesce(${schema.materials.element}, '')`
          : sortBy === 'quantity'
            ? sql`${schema.materials.quantity}`
            : sortBy === 'name'
              ? sql`${schema.materials.name}`
              : sql`${schema.materials.createdAt}`;
  const order = sortOrder === 'asc' ? asc : desc;
  const pagedRows = await q
    .select()
    .from(schema.materials)
    .where(materialWhere)
    .orderBy(order(sortExpression), order(schema.materials.id))
    .limit(pageSize)
    .offset(offset);

  const totalPages = Math.ceil(total / pageSize);
  return {
    items: pagedRows.map((row) =>
      mapMaterialRow(row),
    ) as InventoryItemByType[T][],
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function consumeConsumableById(
  userId: string,
  cultivatorId: string,
  consumableId: string,
  quantity: number,
  tx?: DbTransaction,
): Promise<{
  remainingQuantity: number;
  removed: boolean;
  remaining: Consumable | null;
}> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
  return consumeBagConsumable(cultivatorId, consumableId, quantity, dbInstance);
}
