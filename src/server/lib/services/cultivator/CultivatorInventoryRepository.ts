import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { createHash } from 'node:crypto';
import {
  calculateSingleArtifactScore,
  calculateSingleElixirScore,
} from '@server/utils/rankingUtils';
import {
  rehydrateStoredProductModel,
  serializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import {
  ELEMENT_VALUES,
  ElementType,
  EquipmentSlot,
  MaterialType,
  Quality,
  QUALITY_ORDER,
} from '@shared/types/constants';
import type {
  Artifact,
  Consumable,
  Cultivator,
  EquippedItems,
  Material,
} from '@shared/types/cultivator';
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
} from '../../drizzle/db';
import * as schema from '../../drizzle/schema';
import { mapConsumableRow } from '../consumablePersistence';
import { buildConsumableStackKey } from '@shared/lib/consumables';
import { toArtifactFromProduct } from '../creationProductArtifactSupport';
import { sanitizeMaterialDetails } from '../materialDetailsPrivacy';
import { addMaterialStackToInventory } from '../materialInventory';

import { assertCultivatorOwnership } from './CultivatorStateRepository';

function hashConsumableStackSignature(signature: string): string {
  return createHash('sha256').update(signature).digest('hex');
}
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
    details: sanitizeMaterialDetails(m.details),
    quantity: m.quantity,
  };
}

export async function getCultivatorConsumableById(
  cultivatorId: string,
  consumableId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<Consumable | null> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.id, consumableId),
      ),
    )
    .limit(1);
  return row ? mapConsumableRow(row) : null;
}

export async function getCultivatorMaterialById(
  cultivatorId: string,
  materialId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<Material | null> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select()
    .from(schema.materials)
    .where(
      and(
        eq(schema.materials.cultivatorId, cultivatorId),
        eq(schema.materials.id, materialId),
      ),
    )
    .limit(1);
  return row ? mapMaterialRow(row) : null;
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
    items: pagedRows.map(mapMaterialRow) as InventoryItemByType[T][],
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

// ===== 物品栏和装备相关操作 =====

/**
 * 装备/卸下装备
 */
export async function equipEquipment(
  userId: string,
  cultivatorId: string,
  artifactId: string,
): Promise<EquippedItems> {
  // 权限验证
  const existing = await getExecutor()
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existing.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 获取装备信息
  const artifact = await creationProductRepository.findById(artifactId);

  if (
    !artifact ||
    artifact.cultivatorId !== cultivatorId ||
    artifact.productType !== 'artifact'
  ) {
    throw new Error('装备不存在或无权限操作');
  }

  const slot = (artifact.slot as EquipmentSlot) || 'weapon';
  if (artifact.isEquipped) {
    await creationProductRepository.unequipArtifact(artifactId);
  } else {
    await creationProductRepository.equipArtifact(
      artifactId,
      cultivatorId,
      slot,
    );
  }

  const equippedArtifacts =
    await creationProductRepository.findEquippedArtifacts(cultivatorId);

  return {
    weapon:
      equippedArtifacts.find((item) => item.slot === 'weapon')?.id ?? null,
    armor: equippedArtifacts.find((item) => item.slot === 'armor')?.id ?? null,
    accessory:
      equippedArtifacts.find((item) => item.slot === 'accessory')?.id ?? null,
  };
}

// ===== 资源管理引擎底层操作 =====

/**
 * [安全守卫] 资源变化量安全限制
 * 防止外部 LLM 注入极端数值导致经济系统崩溃
 * - MAX_SINGLE_DELTA: 单次操作允许的最大变化量（绝对值）
 * - RESOURCE_CEILING: 资源绝对上限
 */

/**
 * 添加材料到物品栏（如果已存在则增加数量）
 */
export async function addMaterialToInventory(
  userId: string,
  cultivatorId: string,
  material: Material,
  tx?: DbTransaction,
): Promise<Material> {
  const q = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, q);
  if (!tx) {
    return getExecutor().transaction((transaction) =>
      addMaterialToInventoryInTransaction(cultivatorId, material, transaction),
    );
  }
  return addMaterialToInventoryInTransaction(cultivatorId, material, tx);
}

export async function addMaterialToInventoryInTransaction(
  cultivatorId: string,
  material: Material,
  tx: DbTransaction,
): Promise<Material> {
  const q = getExecutor(tx);
  const result = await addMaterialStackToInventory(cultivatorId, material, tx);
  const stored = await getCultivatorMaterialById(cultivatorId, result.id, q);
  if (!stored) throw new Error('材料入库失败');
  return stored;
}

/**
 * 从物品栏移除材料
 */
export async function removeMaterialFromInventoryInTransaction(
  cultivatorId: string,
  materialName: string,
  quantity: number,
  tx: DbTransaction,
): Promise<
  Array<
    | { operation: 'upsert'; item: Material }
    | { operation: 'remove'; id: string }
  >
> {
  const dbInstance = getExecutor(tx);
  const materials = await dbInstance
    .select()
    .from(schema.materials)
    .where(
      and(
        eq(schema.materials.cultivatorId, cultivatorId),
        eq(schema.materials.name, materialName),
      ),
    );

  const sortedMaterials = sortMaterialsByQualityAsc(materials);
  if (sortedMaterials.length === 0) {
    throw new Error(`材料 ${materialName} 不存在`);
  }

  const totalQuantity = sortedMaterials.reduce(
    (sum, material) => sum + material.quantity,
    0,
  );
  if (totalQuantity < quantity) {
    throw new Error(
      `材料 ${materialName} 不足，需要 ${quantity}，当前拥有 ${totalQuantity}`,
    );
  }

  let remaining = quantity;
  const changes: Array<
    | { operation: 'upsert'; item: Material }
    | { operation: 'remove'; id: string }
  > = [];
  for (const material of sortedMaterials) {
    if (remaining <= 0) break;

    const consumeQuantity = Math.min(material.quantity, remaining);
    remaining -= consumeQuantity;

    if (consumeQuantity === material.quantity) {
      await dbInstance
        .delete(schema.materials)
        .where(eq(schema.materials.id, material.id));
      changes.push({ operation: 'remove', id: material.id });
    } else {
      const [updated] = await dbInstance
        .update(schema.materials)
        .set({ quantity: material.quantity - consumeQuantity })
        .where(eq(schema.materials.id, material.id))
        .returning();
      if (!updated) throw new Error('材料数量更新失败');
      changes.push({ operation: 'upsert', item: mapMaterialRow(updated) });
    }
  }
  return changes;
}

export async function consumeMaterialById(
  userId: string,
  cultivatorId: string,
  materialId: string,
  quantity: number,
  tx?: DbTransaction,
): Promise<
  { operation: 'upsert'; item: Material } | { operation: 'remove'; id: string }
> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
  const rows = await dbInstance
    .select()
    .from(schema.materials)
    .where(
      and(
        eq(schema.materials.id, materialId),
        eq(schema.materials.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    throw new Error('材料不存在或已被耗尽');
  }

  if (existing.quantity < quantity) {
    throw new Error(`材料数量不足，当前仅有 ${existing.quantity}`);
  }

  if (existing.quantity === quantity) {
    await dbInstance
      .delete(schema.materials)
      .where(eq(schema.materials.id, existing.id));
    return { operation: 'remove', id: existing.id };
  }

  const [updated] = await dbInstance
    .update(schema.materials)
    .set({ quantity: existing.quantity - quantity })
    .where(eq(schema.materials.id, existing.id))
    .returning();
  if (!updated) throw new Error('材料数量更新失败');
  return { operation: 'upsert', item: mapMaterialRow(updated) };
}

function sortMaterialsByQualityAsc<
  T extends {
    id: string;
    rank: string;
    quantity: number;
    createdAt: Date | null;
  },
>(materials: T[]): T[] {
  return [...materials].sort((a, b) => {
    const rankDiff =
      (QUALITY_ORDER[a.rank as Quality] ?? Number.MAX_SAFE_INTEGER) -
      (QUALITY_ORDER[b.rank as Quality] ?? Number.MAX_SAFE_INTEGER);
    if (rankDiff !== 0) return rankDiff;

    const createdDiff =
      (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    if (createdDiff !== 0) return createdDiff;

    return a.id.localeCompare(b.id);
  });
}

/**
 * 添加法宝到物品栏
 */
export async function addArtifactToInventory(
  userId: string,
  cultivatorId: string,
  artifact: Artifact,
  tx?: DbTransaction,
): Promise<Artifact> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
  if (!tx) {
    return getExecutor().transaction((transaction) =>
      addArtifactToInventoryInTransaction(cultivatorId, artifact, transaction),
    );
  }
  return addArtifactToInventoryInTransaction(cultivatorId, artifact, tx);
}

export async function addArtifactToInventoryInTransaction(
  cultivatorId: string,
  artifact: Artifact,
  tx: DbTransaction,
): Promise<Artifact> {
  const dbInstance = getExecutor(tx);
  const score = calculateSingleArtifactScore(artifact);
  const rawProductModel =
    artifact.productModel &&
    typeof artifact.productModel === 'object' &&
    !Array.isArray(artifact.productModel)
      ? (artifact.productModel as Record<string, unknown>)
      : null;
  const normalizedProductModel = rehydrateStoredProductModel(
    rawProductModel,
    artifact.element,
  );

  if (!rawProductModel || !normalizedProductModel) {
    throw new Error('法宝数据缺少有效 productModel，无法入库');
  }

  const inserted = await creationProductRepository.insert(
    {
      cultivatorId,
      productType: 'artifact',
      name: artifact.name,
      description: artifact.description || null,
      element: artifact.element,
      quality: artifact.quality || '凡品',
      slot: artifact.slot,
      score,
      isEquipped: false,
      productModel: serializeProductModel(normalizedProductModel),
    },
    dbInstance,
  );
  return mapArtifactRow(toArtifactFromProduct(inserted));
}

/**
 * 添加消耗品到物品栏（如果已存在则增加数量）
 */
export async function addConsumableToInventory(
  userId: string,
  cultivatorId: string,
  consumable: Consumable,
  tx?: DbTransaction,
): Promise<Consumable> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
  if (!tx) {
    return getExecutor().transaction((transaction) =>
      addConsumableToInventoryInTransaction(
        cultivatorId,
        consumable,
        transaction,
      ),
    );
  }
  return addConsumableToInventoryInTransaction(cultivatorId, consumable, tx);
}

export async function addConsumableToInventoryInTransaction(
  cultivatorId: string,
  consumable: Consumable,
  tx: DbTransaction,
): Promise<Consumable> {
  const dbInstance = getExecutor(tx);
  const score = calculateSingleElixirScore(consumable);
  const quality = consumable.quality || '凡品';
  const stackKey = hashConsumableStackSignature(
    buildConsumableStackKey({
      ...consumable,
      quality,
    }),
  );
  const [saved] = await dbInstance
    .insert(schema.consumables)
    .values({
      cultivatorId,
      name: consumable.name,
      type: consumable.type,
      prompt: consumable.prompt || '',
      quality,
      stackKey,
      spec: consumable.spec,
      quantity: consumable.quantity,
      description: consumable.description || null,
      score,
    })
    .onConflictDoUpdate({
      target: [
        schema.consumables.cultivatorId,
        schema.consumables.name,
        schema.consumables.quality,
        schema.consumables.type,
        schema.consumables.stackKey,
      ],
      targetWhere: sql`${schema.consumables.stackKey} is not null`,
      set: {
        quantity: sql`${schema.consumables.quantity} + ${consumable.quantity}`,
        score: sql`GREATEST(${schema.consumables.score}, ${score})`,
        prompt: consumable.prompt || '',
        spec: consumable.spec,
        description: consumable.description || null,
        stackKey,
      },
    })
    .returning();
  if (!saved) throw new Error('消耗品入库失败');
  return mapConsumableRow(saved);
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
  const rows = await dbInstance
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.id, consumableId),
        eq(schema.consumables.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    throw new Error('消耗品不存在或已被耗尽');
  }

  if (existing.quantity < quantity) {
    throw new Error(`消耗品数量不足，当前仅有 ${existing.quantity}`);
  }

  if (existing.quantity === quantity) {
    await dbInstance
      .delete(schema.consumables)
      .where(eq(schema.consumables.id, existing.id));
    return { remainingQuantity: 0, removed: true, remaining: null };
  }

  const [updated] = await dbInstance
    .update(schema.consumables)
    .set({ quantity: existing.quantity - quantity })
    .where(eq(schema.consumables.id, existing.id))
    .returning();
  if (!updated) throw new Error('消耗品数量更新失败');
  return {
    remainingQuantity: updated.quantity,
    removed: false,
    remaining: mapConsumableRow(updated),
  };
}

/**
 * 更新角色上次领取收益时间（内部版本，用于事务中）
 * 跳过权限检查，由调用方保证权限
 */
