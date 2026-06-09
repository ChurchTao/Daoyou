import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { itemLibrary } from '@server/lib/drizzle/schema';
import {
  ItemLibraryEntrySchema,
  type CreateItemLibraryEntry,
  type ItemLibraryEntry,
  type ItemLibraryRewardSelection,
  type UpdateItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';

type ItemLibraryRow = typeof itemLibrary.$inferSelect;

export interface ItemLibraryListFilters {
  status?: 'published' | 'archived';
  type?: 'material' | 'consumable' | 'artifact';
  q?: string;
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
): Promise<ItemLibraryEntry[]> {
  const q = getExecutor();
  const whereConditions: SQL<unknown>[] = [];

  if (filters.status) {
    whereConditions.push(eq(itemLibrary.status, filters.status));
  }
  if (filters.type) {
    whereConditions.push(eq(itemLibrary.type, filters.type));
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

  const query = q
    .select()
    .from(itemLibrary)
    .orderBy(desc(itemLibrary.updatedAt), desc(itemLibrary.createdAt));
  const rows =
    whereConditions.length > 0
      ? await query.where(and(...whereConditions))
      : await query;

  return rows.map(parseRow);
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
