import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { itemLibrary } from '@server/lib/drizzle/schema';
import { computeItemLibrarySampleKey } from './itemLibrarySampleKey';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import type { MaterialSkeleton } from '@shared/engine/material/creation/types';
import {
  ItemLibraryEntrySchema,
  type CreateItemLibraryEntry,
  type ItemLibraryEntry,
  type ItemLibraryMaterialGenerateInput,
} from '@shared/lib/itemLibrary';
import {
  QUALITY_ORDER,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';

type ItemLibraryRow = typeof itemLibrary.$inferSelect;

export interface MaterialLibrarySampleRequest {
  materialType: MaterialType;
  quality: Quality;
  count: number;
}

export interface MaterialLibraryRangeSampleRequest {
  materialType: MaterialType;
  rankRange: { min: Quality; max: Quality };
  count: number;
}

export const ITEM_LIBRARY_SYSTEM_USER_ID =
  '00000000-0000-4000-8000-000000000000';

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

function toMaterialEntry(entry: ItemLibraryEntry): Extract<ItemLibraryEntry, { type: 'material' }> {
  if (entry.type !== 'material') {
    throw new Error(`道具库条目不是材料：${entry.itemId}`);
  }
  return entry;
}

function buildItemId(args: {
  materialType: MaterialType;
  quality: Quality;
  index: number;
  seed: string;
}) {
  const qualityPart = encodeURIComponent(args.quality)
    .replace(/%/g, '')
    .toLowerCase();
  const keyPart = computeItemLibrarySampleKey(
    `${args.seed}:${args.materialType}:${args.quality}:${args.index}`,
  )
    .toString(36)
    .slice(2, 10);
  return `mat_${args.materialType}_${qualityPart}_${keyPart}_${args.index}`;
}

function normalizePositiveCount(countValue: number) {
  return Math.max(0, Math.floor(Number.isFinite(countValue) ? countValue : 0));
}

const DAILY_MARKET_QUALITY_WEIGHTS: Array<{
  quality: Quality;
  weight: number;
}> = [
  { quality: '真品', weight: 45 },
  { quality: '地品', weight: 25 },
  { quality: '天品', weight: 17 },
  { quality: '仙品', weight: 9 },
  { quality: '神品', weight: 4 },
];

const DAILY_MARKET_TYPE_WEIGHTS: Array<{
  materialType: MaterialType;
  weight: number;
}> = [
  { materialType: 'tcdb', weight: 5 },
  { materialType: 'aux', weight: 4 },
  { materialType: 'gongfa_manual', weight: 4 },
  { materialType: 'skill_manual', weight: 4 },
  { materialType: 'herb', weight: 1 },
  { materialType: 'ore', weight: 1 },
  { materialType: 'monster', weight: 1 },
];

function allocateWeightedCounts<T extends string>(
  totalCount: number,
  weightedItems: Array<{ value: T; weight: number }>,
): Array<{ value: T; count: number }> {
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  const raw = weightedItems.map((item) => {
    const exact = totalWeight > 0 ? (totalCount * item.weight) / totalWeight : 0;
    return {
      value: item.value,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let assigned = raw.reduce((sum, item) => sum + item.count, 0);
  const byRemainder = [...raw].sort((a, b) => b.remainder - a.remainder);

  for (const item of byRemainder) {
    if (assigned >= totalCount) break;
    item.count += 1;
    assigned += 1;
  }

  return raw.map((item) => ({
    value: item.value,
    count: item.count,
  }));
}

function expandWeightedSlots<T extends string>(
  totalCount: number,
  weightedItems: Array<{ value: T; weight: number }>,
): T[] {
  return allocateWeightedCounts(totalCount, weightedItems).flatMap((item) =>
    Array.from({ length: item.count }, () => item.value),
  );
}

export function buildDailyMarketMaterialGenerationPlan(input: {
  count: number;
  seed: string;
  status?: ItemLibraryMaterialGenerateInput['status'];
}): ItemLibraryMaterialGenerateInput[] {
  const count = normalizePositiveCount(input.count);
  if (count <= 0) return [];

  const qualitySlots = expandWeightedSlots(
    count,
    DAILY_MARKET_QUALITY_WEIGHTS.map((item) => ({
      value: item.quality,
      weight: item.weight,
    })),
  );
  const typeSlots = expandWeightedSlots(
    count,
    DAILY_MARKET_TYPE_WEIGHTS.map((item) => ({
      value: item.materialType,
      weight: item.weight,
    })),
  );
  const groups = new Map<string, ItemLibraryMaterialGenerateInput>();

  for (let i = 0; i < count; i++) {
    const materialType = typeSlots[i] ?? 'tcdb';
    const quality = qualitySlots[i] ?? '真品';
    const key = `${materialType}:${quality}`;
    const current = groups.get(key);
    groups.set(key, {
      count: (current?.count ?? 0) + 1,
      materialType,
      quality,
      status: input.status ?? 'published',
      seed: `${input.seed}:${key}`,
    });
  }

  return Array.from(groups.values());
}

function materialEntryToWrite(entry: ItemLibraryEntry): Material {
  const material = toMaterialEntry(entry);
  return {
    name: material.payload.name,
    type: material.payload.type,
    rank: material.payload.rank,
    element: material.payload.element,
    description: material.payload.description,
    details: {},
    quantity: 1,
  };
}

export function materialLibraryEntryToMaterial(entry: ItemLibraryEntry): Material {
  return materialEntryToWrite(entry);
}

export async function generateMaterialLibraryEntries(input: {
  request: ItemLibraryMaterialGenerateInput;
  userId: string;
}): Promise<ItemLibraryEntry[]> {
  const skeletons: MaterialSkeleton[] = Array.from(
    { length: input.request.count },
    () => ({
      type: input.request.materialType,
      rank: input.request.quality,
      quantity: 1,
    }),
  );
  const generated = await MaterialGenerator.generateFromSkeletons(skeletons);
  if (generated.length === 0) return [];
  const seed =
    input.request.seed ??
    `batch:${input.request.materialType}:${input.request.quality}:${new Date().toISOString()}`;

  const values = generated.map((material, index) => {
    const sampleSeed = `${seed}:${input.request.materialType}:${input.request.quality}:${index}`;
    const entry: CreateItemLibraryEntry = {
      itemId: buildItemId({
        materialType: input.request.materialType,
        quality: input.request.quality,
        index,
        seed,
      }),
      type: 'material',
      status: input.request.status,
      payload: {
        name: material.name,
        type: material.type,
        rank: material.rank,
        element: material.element,
        description: material.description,
      },
      editorConfig: {
        source: 'llm_batch',
        generatedAt: new Date().toISOString(),
      },
    };
    return {
      itemId: entry.itemId,
      type: entry.type,
      status: entry.status,
      name: entry.payload.name,
      description: entry.payload.description ?? null,
      quality: entry.payload.rank,
      element: entry.payload.element ?? null,
      category: entry.payload.type,
      sampleKey: computeItemLibrarySampleKey(sampleSeed),
      payload: entry.payload,
      editorConfig: entry.editorConfig,
      createdBy: input.userId,
      updatedBy: input.userId,
    };
  });

  const rows = await getExecutor().insert(itemLibrary).values(values).returning();
  return rows.map(parseRow);
}

export async function generateRandomMaterialLibraryEntries(input: {
  count: number;
  userId: string;
  source: string;
  seed?: string;
}): Promise<ItemLibraryEntry[]> {
  const count = normalizePositiveCount(input.count);
  if (count <= 0) return [];

  const generated = await MaterialGenerator.generateRandom(count);
  if (generated.length === 0) return [];

  const seed =
    input.seed ?? `random:${input.source}:${new Date().toISOString()}`;
  const generatedAt = new Date().toISOString();
  const values = generated.map((material, index) => {
    const sampleSeed = `${seed}:${material.type}:${material.rank}:${index}`;
    const itemId = buildItemId({
      materialType: material.type,
      quality: material.rank,
      index,
      seed,
    });
    return {
      itemId,
      type: 'material' as const,
      status: 'published' as const,
      name: material.name,
      description: material.description ?? null,
      quality: material.rank,
      element: material.element ?? null,
      category: material.type,
      sampleKey: computeItemLibrarySampleKey(sampleSeed),
      payload: {
        name: material.name,
        type: material.type,
        rank: material.rank,
        element: material.element,
        description: material.description,
      },
      editorConfig: {
        source: input.source,
        generatedAt,
        seed,
      },
      createdBy: input.userId,
      updatedBy: input.userId,
    };
  });

  const rows = await getExecutor().insert(itemLibrary).values(values).returning();
  return rows.map(parseRow);
}

export async function generateDailyMarketMaterialLibraryEntries(input: {
  count: number;
  userId: string;
  source: string;
  seed?: string;
}): Promise<ItemLibraryEntry[]> {
  const seed =
    input.seed ?? `daily_market:${input.source}:${new Date().toISOString()}`;
  const plan = buildDailyMarketMaterialGenerationPlan({
    count: input.count,
    seed,
    status: 'published',
  });
  const generated: ItemLibraryEntry[] = [];

  for (const request of plan) {
    const entries = await generateMaterialLibraryEntries({
      request,
      userId: input.userId,
    });
    generated.push(...entries);
  }

  return generated;
}

async function sampleExactMaterialEntries(
  request: MaterialLibrarySampleRequest,
  executor?: DbExecutor,
): Promise<ItemLibraryEntry[]> {
  const count = normalizePositiveCount(request.count);
  if (count <= 0) return [];

  const q = executor ?? getExecutor();
  const anchor = Math.random();
  const baseWhere = and(
    eq(itemLibrary.type, 'material'),
    eq(itemLibrary.status, 'published'),
    eq(itemLibrary.category, request.materialType),
    eq(itemLibrary.quality, request.quality),
  );

  const firstRows = await q
    .select()
    .from(itemLibrary)
    .where(and(baseWhere, gte(itemLibrary.sampleKey, anchor)))
    .orderBy(asc(itemLibrary.sampleKey), asc(itemLibrary.itemId))
    .limit(count);

  let rows = firstRows;
  if (rows.length < count) {
    const seen = new Set(rows.map((row) => row.id));
    const restRows = await q
      .select()
      .from(itemLibrary)
      .where(and(baseWhere, sql`${itemLibrary.sampleKey} < ${anchor}`))
      .orderBy(asc(itemLibrary.sampleKey), asc(itemLibrary.itemId))
      .limit(count - rows.length);
    rows = [...rows, ...restRows.filter((row) => !seen.has(row.id))];
  }

  return rows.map(parseRow);
}

export async function sampleMaterialLibraryEntries(
  requests: MaterialLibrarySampleRequest[],
  executor?: DbExecutor,
): Promise<Map<string, ItemLibraryEntry[]>> {
  const result = new Map<string, ItemLibraryEntry[]>();
  for (const request of requests) {
    const key = `${request.materialType}:${request.quality}`;
    const current = result.get(key) ?? [];
    const entries = await sampleExactMaterialEntries(request, executor);
    result.set(key, [...current, ...entries]);
  }
  return result;
}

function qualitiesInRange(range: { min: Quality; max: Quality }): Quality[] {
  const min = Math.min(QUALITY_ORDER[range.min], QUALITY_ORDER[range.max]);
  const max = Math.max(QUALITY_ORDER[range.min], QUALITY_ORDER[range.max]);
  return Object.entries(QUALITY_ORDER)
    .filter(([, order]) => order >= min && order <= max)
    .map(([quality]) => quality) as Quality[];
}

export async function sampleMaterialForRange(
  request: MaterialLibraryRangeSampleRequest,
  executor?: DbExecutor,
): Promise<ItemLibraryEntry | null> {
  const qualities = qualitiesInRange(request.rankRange);
  if (qualities.length === 0) return null;
  const anchor = Math.random();
  const q = executor ?? getExecutor();
  const baseWhere = and(
    eq(itemLibrary.type, 'material'),
    eq(itemLibrary.status, 'published'),
    eq(itemLibrary.category, request.materialType),
    inArray(itemLibrary.quality, qualities),
  );

  const [first] = await q
    .select()
    .from(itemLibrary)
    .where(and(baseWhere, gte(itemLibrary.sampleKey, anchor)))
    .orderBy(asc(itemLibrary.sampleKey), asc(itemLibrary.itemId))
    .limit(1);
  if (first) return parseRow(first);

  const [wrapped] = await q
    .select()
    .from(itemLibrary)
    .where(and(baseWhere, sql`${itemLibrary.sampleKey} < ${anchor}`))
    .orderBy(asc(itemLibrary.sampleKey), asc(itemLibrary.itemId))
    .limit(1);
  return wrapped ? parseRow(wrapped) : null;
}
