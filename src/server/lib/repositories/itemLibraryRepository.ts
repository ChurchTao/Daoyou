import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { itemLibrary } from '@server/lib/drizzle/schema';
import { computeItemLibrarySampleKey } from '@server/lib/services/itemLibrarySampleKey';
import {
  ItemLibraryEntrySchema,
  type CreateItemLibraryEntry,
  type ItemLibraryEntry,
  type ItemLibraryListQuery,
  type ItemLibraryRewardSelection,
  type UpdateItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from 'drizzle-orm';

type ItemLibraryRow = typeof itemLibrary.$inferSelect;

export interface ItemLibraryListFilters {
  status?: 'published' | 'archived';
  type?: 'material' | 'consumable' | 'artifact';
  materialType?: string;
  quality?: string;
  q?: string;
  itemIds?: string[];
  page?: number;
  pageSize?: number;
}

export interface ItemLibraryListResult {
  items: ItemLibraryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function parseRow(row: ItemLibraryRow): ItemLibraryEntry {
  return ItemLibraryEntrySchema.parse({
    id: row.id,
    itemId: row.itemId,
    type: row.type,
    status: row.status,
    name: row.name,
    description: row.description,
    quality: row.quality,
    element: row.element,
    category: row.category,
    payload: row.payload,
    editorConfig: row.editorConfig,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toSearchableColumns(entry: CreateItemLibraryEntry | UpdateItemLibraryEntry) {
  switch (entry.type) {
    case 'material':
      return {
        name: entry.payload.name,
        description: entry.payload.description ?? null,
        quality: entry.payload.rank,
        element: entry.payload.element ?? null,
        category: entry.payload.type,
      };
    case 'consumable':
      return {
        name: entry.payload.name,
        description: entry.payload.description ?? null,
        quality: entry.payload.quality ?? null,
        element:
          entry.payload.spec.kind === 'pill'
            ? entry.payload.spec.alchemyMeta.dominantElement ?? null
            : null,
        category: entry.payload.type,
      };
    case 'artifact':
      return {
        name: entry.payload.name,
        description: entry.payload.description ?? null,
        quality: entry.payload.quality ?? null,
        element: entry.payload.element,
        category: entry.payload.slot,
      };
  }
}

export async function listItemLibrary(
  filters: ItemLibraryListFilters = {},
): Promise<ItemLibraryListResult> {
  const q = getExecutor();
  const whereConditions: SQL<unknown>[] = [];
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (filters.status) {
    whereConditions.push(eq(itemLibrary.status, filters.status));
  }
  if (filters.type) {
    whereConditions.push(eq(itemLibrary.type, filters.type));
  }
  if (filters.materialType) {
    whereConditions.push(eq(itemLibrary.category, filters.materialType));
  }
  if (filters.quality) {
    whereConditions.push(eq(itemLibrary.quality, filters.quality));
  }
  if (filters.itemIds && filters.itemIds.length > 0) {
    whereConditions.push(inArray(itemLibrary.itemId, filters.itemIds));
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim()}%`;
    whereConditions.push(
      or(
        ilike(itemLibrary.itemId, pattern),
        ilike(itemLibrary.name, pattern),
      )!,
    );
  }

  const whereExpr = whereConditions.length > 0 ? and(...whereConditions) : undefined;
  const totalQuery = q.select({ total: count() }).from(itemLibrary);
  const [totalRow] = whereExpr
    ? await totalQuery.where(whereExpr)
    : await totalQuery;

  const query = q
    .select()
    .from(itemLibrary)
    .orderBy(desc(itemLibrary.updatedAt), desc(itemLibrary.createdAt))
    .limit(pageSize)
    .offset(offset);
  const rows =
    whereExpr
      ? await query.where(whereExpr)
      : await query;

  const total = Number(totalRow?.total ?? 0);
  return {
    items: rows.map(parseRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function normalizeItemLibraryFilters(
  query: ItemLibraryListQuery,
): ItemLibraryListFilters {
  const itemIds = query.itemIds
    ?.split(',')
    .map((itemId) => itemId.trim())
    .filter(Boolean);

  return {
    status: query.status,
    type: query.type,
    materialType: query.type === 'material' ? query.materialType : undefined,
    quality: query.quality,
    q: query.q,
    itemIds,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function findItemLibraryById(
  id: string,
): Promise<ItemLibraryEntry | null> {
  const q = getExecutor();
  const [row] = await q
    .select()
    .from(itemLibrary)
    .where(eq(itemLibrary.id, id))
    .limit(1);
  return row ? parseRow(row) : null;
}

export async function findPublishedItemLibraryByItemIds(
  itemIds: string[],
  executor?: DbExecutor,
): Promise<ItemLibraryEntry[]> {
  const uniqueIds = Array.from(new Set(itemIds));
  if (uniqueIds.length === 0) return [];

  const q = executor ?? getExecutor();
  const rows = await q
    .select()
    .from(itemLibrary)
    .where(
      and(
        eq(itemLibrary.status, 'published'),
        inArray(itemLibrary.itemId, uniqueIds),
      ),
    );

  return rows.map(parseRow);
}

export async function findItemLibraryByItemIds(
  itemIds: string[],
  executor?: DbExecutor,
): Promise<ItemLibraryEntry[]> {
  const uniqueIds = Array.from(new Set(itemIds));
  if (uniqueIds.length === 0) return [];

  const q = executor ?? getExecutor();
  const rows = await q
    .select()
    .from(itemLibrary)
    .where(inArray(itemLibrary.itemId, uniqueIds))
    .orderBy(asc(itemLibrary.itemId));

  return rows.map(parseRow);
}

export async function findPublishedItemLibraryForSelections(
  selections: ItemLibraryRewardSelection[],
): Promise<ItemLibraryEntry[]> {
  const itemIds = selections
    .filter((selection) => selection.type === 'item_library')
    .map((selection) => selection.itemId);

  return findPublishedItemLibraryByItemIds(itemIds);
}

export async function createItemLibraryEntry(params: {
  entry: CreateItemLibraryEntry;
  userId: string;
}): Promise<ItemLibraryEntry> {
  const columns = toSearchableColumns(params.entry);
  const q = getExecutor();
  const [row] = await q
    .insert(itemLibrary)
    .values({
      itemId: params.entry.itemId,
      type: params.entry.type,
      status: params.entry.status,
      ...columns,
      sampleKey: computeItemLibrarySampleKey(params.entry.itemId),
      payload: params.entry.payload,
      editorConfig: params.entry.editorConfig,
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning();

  return parseRow(row);
}

export async function updateItemLibraryEntry(params: {
  id: string;
  entry: UpdateItemLibraryEntry;
  userId: string;
}): Promise<ItemLibraryEntry | null> {
  const columns = toSearchableColumns(params.entry);
  const q = getExecutor();
  const [row] = await q
    .update(itemLibrary)
    .set({
      type: params.entry.type,
      status: params.entry.status,
      ...columns,
      payload: params.entry.payload,
      editorConfig: params.entry.editorConfig,
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(itemLibrary.id, params.id))
    .returning();

  return row ? parseRow(row) : null;
}

export async function archiveItemLibraryEntry(params: {
  id: string;
  userId: string;
}): Promise<ItemLibraryEntry | null> {
  const q = getExecutor();
  const [row] = await q
    .update(itemLibrary)
    .set({
      status: 'archived',
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(itemLibrary.id, params.id))
    .returning();

  return row ? parseRow(row) : null;
}
