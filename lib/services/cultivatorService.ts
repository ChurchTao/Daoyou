import { AbilityType } from '@/engine/battle-v5/core/types';
import { normalizePersistentCombatStatuses } from '@/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type { PersistentCombatStatusV5 } from '@/engine/battle-v5/setup/types';
import type { AbilityConfig } from '@/engine/creation-v2/contracts/battle';
import {
  deserializeAbilityConfig,
  serializeAbilityConfig,
  serializeProductModel,
} from '@/engine/creation-v2/persistence/ProductPersistenceMapper';
import { GameplayTags } from '@/engine/shared/tag-domain';
import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import {
  existsCultivatorById,
  findActiveCultivatorIdByUserId,
  findActiveCultivatorRecordById,
  findActiveCultivatorRecordByIdAndUser,
  findActiveCultivatorRecordByUserId,
  findCultivatorOwnerStatusById,
  hasCultivatorOwnership,
  hasDeadCultivatorByUserId,
  loadCultivatorRelations,
  type CultivatorRecord,
  type CultivatorRelations,
} from '@/lib/repositories/cultivatorRepository';
import {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  GenderType,
  MaterialType,
  Quality,
  QUALITY_ORDER,
  RealmStage,
  RealmType,
  SpiritualRootGrade,
} from '@/types/constants';
import type {
  BreakthroughHistoryEntry,
  Consumable,
  CultivationProgress,
  Cultivator,
  CultivatorPersistentState,
  Material,
  PreHeavenFate,
  RetreatRecord,
} from '@/types/cultivator';
import { getOrInitCultivationProgress } from '@/utils/cultivationUtils';
import {
  calculateSingleArtifactScore,
  calculateSingleElixirScore,
} from '@/utils/rankingUtils';
import { ConsumableRegistry } from './ConsumableRegistry';
import { FateEngine } from './FateEngine';
import { and, desc, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import * as schema from '../drizzle/schema';
import { toArtifactFromProduct } from './creationProductArtifactSupport';

async function assembleCultivatorFromRelations(
  cultivatorRecord: CultivatorRecord,
  relations: CultivatorRelations,
): Promise<Cultivator> {
  const spiritualRootCount = relations.spiritualRoots.length;
  const spiritual_roots = relations.spiritualRoots.map((r) => {
    const element = r.element as ElementType;
    return {
      element,
      strength: r.strength,
      grade:
        (r.grade as SpiritualRootGrade) ??
        resolveSpiritualRootGrade(spiritualRootCount, element),
    };
  });

  const pre_heaven_fates = FateEngine.normalizeFates(
    relations.preHeavenFates.map(
      (f): PreHeavenFate => ({
        name: f.name,
        quality: f.quality as Quality,
        description: f.description || undefined,
        tags:
          ((f.details as Record<string, unknown> | null)?.tags as string[]) ||
          undefined,
        effects:
          ((f.details as Record<string, unknown> | null)?.effects as
            | PreHeavenFate['effects']
            | undefined) || undefined,
        generationModel:
          ((f.details as Record<string, unknown> | null)?.generationModel as
            | PreHeavenFate['generationModel']
            | undefined) || undefined,
        namingMetadata:
          ((f.details as Record<string, unknown> | null)?.namingMetadata as
            | PreHeavenFate['namingMetadata']
            | undefined) || undefined,
      }),
    ),
  );
  const skillProducts = relations.creationProducts.filter(
    (product) => product.productType === 'skill',
  );
  const gongfaProducts = relations.creationProducts.filter(
    (product) => product.productType === 'gongfa',
  );
  const artifactProducts = relations.creationProducts.filter(
    (product) => product.productType === 'artifact',
  );

  const toAbilityConfig = (
    abilityConfig: Record<string, unknown>,
    id: string,
  ): AbilityConfig => deserializeAbilityConfig(abilityConfig, id);

  const cultivations = gongfaProducts.map((product) => {
    const abilityConfig = toAbilityConfig(
      product.abilityConfig as Record<string, unknown>,
      product.id,
    );

    return {
      id: product.id,
      name: product.name,
      element: (product.element as ElementType) || undefined,
      quality: product.quality as Quality | undefined,
      score: product.score || 0,
      description: product.description || undefined,
      attributeModifiers: abilityConfig.modifiers ?? [],
      abilityConfig,
      productModel: product.productModel ?? undefined,
    };
  });

  const skills = skillProducts.map((product) => {
    const abilityConfig = toAbilityConfig(
      product.abilityConfig as Record<string, unknown>,
      product.id,
    );

    return {
      id: product.id,
      name: product.name,
      element: (product.element as ElementType) || '金',
      quality: product.quality as Quality | undefined,
      cost: abilityConfig.mpCost || undefined,
      cooldown: abilityConfig.cooldown ?? 0,
      target_self:
        abilityConfig.targetPolicy?.team === 'self' ? true : undefined,
      description: product.description || undefined,
      abilityConfig,
      productModel: product.productModel ?? undefined,
    };
  });

  const artifacts = artifactProducts.map((product) => {
    const abilityConfig = toAbilityConfig(
      product.abilityConfig as Record<string, unknown>,
      product.id,
    );

    return {
      id: product.id,
      name: product.name,
      slot: (product.slot as EquipmentSlot) || 'weapon',
      element: (product.element as ElementType) || '金',
      quality: product.quality as
        | Cultivator['inventory']['artifacts'][0]['quality']
        | undefined,
      description: product.description || '',
      attributeModifiers: abilityConfig.modifiers ?? [],
      abilityConfig,
      productModel: product.productModel ?? undefined,
      isEquipped: product.isEquipped ?? false,
      score: product.score ?? 0,
    };
  });

  const equipped: Cultivator['equipped'] = {
    weapon:
      artifactProducts.find(
        (product) => product.isEquipped && product.slot === 'weapon',
      )?.id ?? null,
    armor:
      artifactProducts.find(
        (product) => product.isEquipped && product.slot === 'armor',
      )?.id ?? null,
    accessory:
      artifactProducts.find(
        (product) => product.isEquipped && product.slot === 'accessory',
      )?.id ?? null,
  };

  const consumables: Consumable[] = [];
  const materials: Material[] = [];
  const retreat_records: RetreatRecord[] = [];
  const breakthrough_history: BreakthroughHistoryEntry[] = [];

  return {
    id: cultivatorRecord.id,
    name: cultivatorRecord.name,
    title: cultivatorRecord.title || undefined,
    gender: (cultivatorRecord.gender as GenderType) || undefined,
    origin: cultivatorRecord.origin || undefined,
    personality: cultivatorRecord.personality || undefined,
    background: cultivatorRecord.background || undefined,
    prompt: cultivatorRecord.prompt,
    realm: cultivatorRecord.realm as RealmType,
    realm_stage: cultivatorRecord.realm_stage as RealmStage,
    age: cultivatorRecord.age,
    lifespan: cultivatorRecord.lifespan,
    status: (cultivatorRecord.status as Cultivator['status']) ?? 'active',
    closed_door_years_total: cultivatorRecord.closedDoorYearsTotal ?? undefined,
    retreat_records,
    breakthrough_history,
    attributes: {
      vitality: cultivatorRecord.vitality,
      spirit: cultivatorRecord.spirit,
      wisdom: cultivatorRecord.wisdom,
      speed: cultivatorRecord.speed,
      willpower: cultivatorRecord.willpower,
    },
    spiritual_roots,
    pre_heaven_fates,
    cultivations,
    skills,
    inventory: {
      artifacts,
      consumables,
      materials,
    },
    equipped,
    max_skills: cultivatorRecord.max_skills,
    spirit_stones: cultivatorRecord.spirit_stones,
    last_yield_at: cultivatorRecord.last_yield_at || new Date(),
    balance_notes: cultivatorRecord.balance_notes || undefined,
    cultivation_progress: getOrInitCultivationProgress(
      cultivatorRecord.cultivation_progress as CultivationProgress,
      cultivatorRecord.realm as Cultivator['realm'],
      cultivatorRecord.realm_stage as Cultivator['realm_stage'],
    ),
    persistent_statuses:
      normalizePersistentCombatStatuses(cultivatorRecord.persistent_statuses),
    persistent_state:
      (cultivatorRecord.persistent_state as CultivatorPersistentState | null) ??
      undefined,
  };
}

/**
 * 将数据库记录组装成完整的 Cultivator 对象
 */
async function assembleCultivator(
  cultivatorRecord: CultivatorRecord,
  userId: string,
  executor?: DbExecutor,
  prefetchedRelations?: CultivatorRelations,
): Promise<Cultivator | null> {
  if (cultivatorRecord.userId !== userId) {
    return null; // 权限检查
  }

  if (prefetchedRelations) {
    return assembleCultivatorFromRelations(
      cultivatorRecord,
      prefetchedRelations,
    );
  }

  const q = executor ?? getExecutor();
  const relations = await loadCultivatorRelations(q, cultivatorRecord.id);
  return assembleCultivatorFromRelations(cultivatorRecord, relations);
}

/**
 * 从数据库记录创建最小化的 Cultivator 对象
 * 仅包含效果引擎需要的核心字段，避免查询关联表
 * 用于需要快速访问角色基础信息和属性的场景
 *
 * @param cultivatorRecord - 数据库中的 cultivators 表记录
 * @returns 最小化的 Cultivator 对象
 */
export function createMinimalCultivator(
  cultivatorRecord: typeof schema.cultivators.$inferSelect,
): Cultivator {
  return {
    id: cultivatorRecord.id,
    name: cultivatorRecord.name,
    gender: (cultivatorRecord.gender as Cultivator['gender']) || undefined,
    origin: cultivatorRecord.origin || undefined,
    personality: cultivatorRecord.personality || undefined,
    background: cultivatorRecord.background || undefined,
    title: cultivatorRecord.title || undefined,
    prompt: cultivatorRecord.prompt,
    realm: cultivatorRecord.realm as Cultivator['realm'],
    realm_stage: cultivatorRecord.realm_stage as Cultivator['realm_stage'],
    age: cultivatorRecord.age,
    lifespan: cultivatorRecord.lifespan,
    status: (cultivatorRecord.status as Cultivator['status']) ?? 'active',
    closed_door_years_total: cultivatorRecord.closedDoorYearsTotal ?? undefined,
    retreat_records: undefined,
    breakthrough_history: undefined,
    attributes: {
      vitality: cultivatorRecord.vitality,
      spirit: cultivatorRecord.spirit,
      wisdom: cultivatorRecord.wisdom,
      speed: cultivatorRecord.speed,
      willpower: cultivatorRecord.willpower,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: cultivatorRecord.max_skills,
    spirit_stones: cultivatorRecord.spirit_stones,
    last_yield_at: cultivatorRecord.last_yield_at || new Date(),
    balance_notes: cultivatorRecord.balance_notes || undefined,
    cultivation_progress: getOrInitCultivationProgress(
      cultivatorRecord.cultivation_progress as CultivationProgress,
      cultivatorRecord.realm as Cultivator['realm'],
      cultivatorRecord.realm_stage as Cultivator['realm_stage'],
    ),
    persistent_statuses:
      normalizePersistentCombatStatuses(cultivatorRecord.persistent_statuses),
    persistent_state:
      (cultivatorRecord.persistent_state as CultivatorPersistentState | null) ??
      undefined,
  };
}

/**
 * 创建角色（从临时表保存到正式表）
 */
export async function createCultivator(
  userId: string,
  cultivator: Cultivator,
): Promise<Cultivator> {
  const q = getExecutor();
  const result = await q.transaction(async (tx) => {
    const normalizedFates = FateEngine.normalizeFates(
      cultivator.pre_heaven_fates,
    );

    // 1. 创建角色主表记录
    const cultivatorResult = await tx
      .insert(schema.cultivators)
      .values({
        userId,
        name: cultivator.name,
        gender: cultivator.gender ?? null,
        origin: cultivator.origin || null,
        personality: cultivator.personality || null,
        background: cultivator.background || null,
        prompt: cultivator.prompt || '',
        realm: cultivator.realm,
        realm_stage: cultivator.realm_stage,
        age: cultivator.age,
        lifespan: cultivator.lifespan,
        closedDoorYearsTotal: cultivator.closed_door_years_total ?? 0,
        status: 'active',
        vitality: cultivator.attributes.vitality,
        spirit: cultivator.attributes.spirit,
        wisdom: cultivator.attributes.wisdom,
        speed: cultivator.attributes.speed,
        willpower: cultivator.attributes.willpower,
        max_skills: cultivator.max_skills,
        persistent_state: cultivator.persistent_state ?? {},
      })
      .returning();

    const cultivatorRecord = cultivatorResult[0];
    const cultivatorId = cultivatorRecord.id;

    // 2. 创建灵根
    if (cultivator.spiritual_roots.length > 0) {
      const spiritualRootCount = cultivator.spiritual_roots.length;
      await tx.insert(schema.spiritualRoots).values(
        cultivator.spiritual_roots.map((root) => ({
          cultivatorId,
          element: root.element,
          strength: root.strength,
          grade:
            root.grade ??
            resolveSpiritualRootGrade(spiritualRootCount, root.element),
        })),
      );
    }

    // 3. 创建先天命格
    if (normalizedFates.length > 0) {
      await tx.insert(schema.preHeavenFates).values(
        normalizedFates.map((fate) => ({
          cultivatorId,
          name: fate.name,
          quality: fate.quality || null,
          registryKey: null,
          details: {
            tags: fate.tags ?? [],
            effects: fate.effects ?? [],
            generationModel: fate.generationModel ?? null,
            namingMetadata: fate.namingMetadata ?? null,
          },
          description: fate.description || null,
        })),
      );
    }

    // 注意：产物与装备状态均由 creation_products 承载，创建角色时无需初始化旧装备表
    // 注意：功法/神通 在角色创建阶段不再初始化，由造物 v2 流程单独生成

    return cultivatorRecord;
  });

  // 返回完整的 Cultivator 对象
  const fullCultivator = await assembleCultivator(result, userId, q);
  if (!fullCultivator) {
    throw new Error('创建角色后无法组装完整数据');
  }
  return fullCultivator;
}

function resolveSpiritualRootGrade(
  rootCount: number,
  element: Cultivator['spiritual_roots'][0]['element'],
): NonNullable<Cultivator['spiritual_roots'][0]['grade']> {
  if (element === '风' || element === '雷' || element === '冰') {
    return '变异灵根';
  }

  if (rootCount === 1) {
    return '天灵根';
  }

  if (rootCount <= 3) {
    return '真灵根';
  }

  return '伪灵根';
}

export async function getUserAliveCultivatorId(
  userId: string,
): Promise<string | null> {
  return findActiveCultivatorIdByUserId(userId, getExecutor());
}

export async function hasActiveCultivator(userId: string): Promise<boolean> {
  return (await getUserAliveCultivatorId(userId)) !== null;
}

/**
 * 根据 ID 获取角色
 */
export async function getCultivatorById(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator | null> {
  const q = getExecutor();
  const cultivatorRecord = await findActiveCultivatorRecordByIdAndUser(
    userId,
    cultivatorId,
    q,
  );
  if (!cultivatorRecord) {
    return null;
  }

  return assembleCultivator(cultivatorRecord, userId, q);
}

/**
 * 获取用户的所有角色
 */
export async function getCultivatorsByUserId(
  userId: string,
): Promise<Cultivator[]> {
  const q = getExecutor();
  const record = await findActiveCultivatorRecordByUserId(userId, q);
  if (!record) {
    return [];
  }

  const cultivator = await assembleCultivator(record, userId, q);
  return cultivator ? [cultivator] : [];
}

export async function hasDeadCultivator(userId: string): Promise<boolean> {
  return hasDeadCultivatorByUserId(userId, getExecutor());
}

export interface CultivatorWithOwner {
  cultivator: Cultivator;
  userId: string;
  updatedAt?: Date | null;
}

export interface CultivatorBasic {
  id: string;
  name: string;
  title: string | null;
  age: number;
  lifespan: number;
  realm: string;
  realm_stage: string;
  origin: string | null;
  gender: string | null;
  personality: string | null;
  background: string | null;
  updatedAt: Date | null;
}

/**
 * 获取角色所属用户ID（不校验当前用户，系统用途）
 */
export async function getCultivatorOwnerId(
  cultivatorId: string,
): Promise<string | null> {
  const record = await findCultivatorOwnerStatusById(
    cultivatorId,
    getExecutor(),
  );
  if (!record || record.status !== 'active') {
    return null;
  }

  return record.userId;
}

/**
 * 根据ID获取角色（系统用途，不做用户匹配校验）
 */
export async function getCultivatorByIdUnsafe(
  cultivatorId: string,
): Promise<CultivatorWithOwner | null> {
  const q = getExecutor();
  const record = await findActiveCultivatorRecordById(cultivatorId, q);
  if (!record) {
    return null;
  }

  const full = await assembleCultivator(record, record.userId, q);
  if (!full) {
    return null;
  }

  return {
    cultivator: full,
    userId: record.userId,
    updatedAt: record.updatedAt,
  };
}

export async function getCultivatorBasicsByIdUnsafe(
  cultivatorId: string,
): Promise<CultivatorBasic | null> {
  const q = getExecutor();
  const record = await q
    .select()
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId));
  if (record.length === 0) {
    return null;
  }
  const row = record[0];
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    age: row.age,
    lifespan: row.lifespan,
    realm: row.realm,
    realm_stage: row.realm_stage,
    origin: row.origin,
    gender: row.gender,
    personality: row.personality,
    background: row.background,
    updatedAt: row.updatedAt,
  };
}

/**
 * 批量获取角色主表基础信息（系统用途）
 */
export async function getCultivatorBasicsByIdsUnsafe(
  cultivatorIds: string[],
): Promise<CultivatorBasic[]> {
  if (cultivatorIds.length === 0) {
    return [];
  }

  const q = getExecutor();
  const rows = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      title: schema.cultivators.title,
      realm: schema.cultivators.realm,
      realm_stage: schema.cultivators.realm_stage,
      gender: schema.cultivators.gender,
      origin: schema.cultivators.origin,
      personality: schema.cultivators.personality,
      background: schema.cultivators.background,
      updatedAt: schema.cultivators.updatedAt,
      status: schema.cultivators.status,
      age: schema.cultivators.age,
      lifespan: schema.cultivators.lifespan,
    })
    .from(schema.cultivators)
    .where(
      and(
        inArray(schema.cultivators.id, cultivatorIds),
        eq(schema.cultivators.status, 'active'),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title,
    age: row.age,
    lifespan: row.lifespan,
    realm: row.realm,
    realm_stage: row.realm_stage,
    origin: row.origin,
    gender: row.gender,
    personality: row.personality,
    background: row.background,
    updatedAt: row.updatedAt,
  }));
}

export async function getLastDeadCultivatorSummary(userId: string): Promise<{
  id: string;
  name: string;
  realm: Cultivator['realm'];
  realm_stage: Cultivator['realm_stage'];
  story?: string;
} | null> {
  const rows = await getExecutor()
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'dead'),
      ),
    )
    .orderBy(schema.cultivators.updatedAt)
    .limit(1);

  if (rows.length === 0) return null;

  const record = rows[0];
  const history = await getExecutor()
    .select()
    .from(schema.breakthroughHistory)
    .where(eq(schema.breakthroughHistory.cultivatorId, record.id))
    .orderBy(schema.breakthroughHistory.createdAt)
    .limit(1);

  const storyEntry = history[0];

  return {
    id: record.id,
    name: record.name,
    realm: record.realm as Cultivator['realm'],
    realm_stage: record.realm_stage as Cultivator['realm_stage'],
    story: storyEntry?.story ?? undefined,
  };
}

/**
 * 更新角色基本信息
 */
export async function updateCultivator(
  cultivatorId: string,
  updates: Partial<
    Pick<
      Cultivator,
      | 'name'
      | 'gender'
      | 'origin'
      | 'personality'
      | 'background'
      | 'realm'
      | 'realm_stage'
      | 'age'
      | 'lifespan'
      | 'attributes'
      | 'max_skills'
      | 'closed_door_years_total'
      | 'status'
      | 'cultivation_progress'
      | 'persistent_statuses'
      | 'persistent_state'
    >
  >,
): Promise<Cultivator | null> {
  if (!(await existsCultivatorById(cultivatorId, getExecutor()))) {
    return null;
  }

  const updateData: Partial<typeof schema.cultivators.$inferInsert> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.gender !== undefined) updateData.gender = updates.gender ?? null;
  if (updates.origin !== undefined) updateData.origin = updates.origin ?? null;
  if (updates.personality !== undefined)
    updateData.personality = updates.personality ?? null;
  if (updates.background !== undefined)
    updateData.background = updates.background ?? null;
  if (updates.realm !== undefined) updateData.realm = updates.realm;
  if (updates.realm_stage !== undefined)
    updateData.realm_stage = updates.realm_stage;
  if (updates.age !== undefined) updateData.age = updates.age;
  if (updates.lifespan !== undefined) updateData.lifespan = updates.lifespan;
  if (updates.attributes !== undefined) {
    updateData.vitality = Math.round(updates.attributes.vitality);
    updateData.spirit = Math.round(updates.attributes.spirit);
    updateData.wisdom = Math.round(updates.attributes.wisdom);
    updateData.speed = Math.round(updates.attributes.speed);
    updateData.willpower = Math.round(updates.attributes.willpower);
  }
  if (updates.max_skills !== undefined)
    updateData.max_skills = updates.max_skills;
  if (updates.closed_door_years_total !== undefined)
    updateData.closedDoorYearsTotal = updates.closed_door_years_total;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.cultivation_progress !== undefined)
    updateData.cultivation_progress = updates.cultivation_progress;
  if (updates.persistent_statuses !== undefined) {
    updateData.persistent_statuses =
      updates.persistent_statuses as PersistentCombatStatusV5[];
  }
  if (updates.persistent_state !== undefined) {
    updateData.persistent_state =
      (updates.persistent_state as CultivatorPersistentState) ?? {};
  }

  await getExecutor()
    .update(schema.cultivators)
    .set(updateData)
    .where(eq(schema.cultivators.id, cultivatorId));
  const res = await getCultivatorByIdUnsafe(cultivatorId);
  return res?.cultivator || null;
}

async function assertCultivatorOwnership(
  userId: string,
  cultivatorId: string,
): Promise<void> {
  if (!(await hasCultivatorOwnership(userId, cultivatorId, getExecutor()))) {
    throw new Error('角色不存在或无权限操作');
  }
}

export async function addRetreatRecord(
  userId: string,
  cultivatorId: string,
  record: RetreatRecord,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);
  await getExecutor()
    .insert(schema.retreatRecords)
    .values({
      cultivatorId,
      realm: record.realm,
      realm_stage: record.realm_stage,
      years: record.years,
      success: record.success ?? false,
      chance: record.chance,
      roll: record.roll,
      timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
      modifiers: record.modifiers,
    });
}

export async function addBreakthroughHistoryEntry(
  userId: string,
  cultivatorId: string,
  entry: BreakthroughHistoryEntry,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);
  await getExecutor()
    .insert(schema.breakthroughHistory)
    .values({
      cultivatorId,
      from_realm: entry.from_realm,
      from_stage: entry.from_stage,
      to_realm: entry.to_realm,
      to_stage: entry.to_stage,
      age: entry.age,
      years_spent: entry.years_spent,
      story: entry.story ?? null,
    });
}

/**
 * 删除角色
 */
export async function deleteCultivator(
  userId: string,
  cultivatorId: string,
): Promise<boolean> {
  if (!(await hasCultivatorOwnership(userId, cultivatorId, getExecutor()))) {
    return false;
  }

  // 由于设置了 onDelete: 'cascade'，删除主表记录会自动删除所有关联记录
  await getExecutor()
    .delete(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  return true;
}

// ===== 单独获取数据的接口 =====

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
  type: T;
  items: InventoryItemByType[T][];
  pagination: InventoryPagination;
}

export type MaterialInventorySortBy =
  | 'createdAt'
  | 'rank'
  | 'type'
  | 'element'
  | 'quantity'
  | 'name';

export type MaterialInventorySortOrder = 'asc' | 'desc';

function mapArtifactRow(
  a: ReturnType<typeof toArtifactFromProduct>,
): Cultivator['inventory']['artifacts'][number] {
  return a;
}

function mapConsumableRow(
  c: typeof schema.consumables.$inferSelect,
): Cultivator['inventory']['consumables'][number] {
  return ConsumableRegistry.normalizeConsumable({
    id: c.id,
    name: c.name,
    quality: c.quality as Quality,
    type: c.type as ConsumableType,
    quantity: c.quantity,
    description: c.description || '',
    prompt: c.prompt || undefined,
    score: c.score || 0,
    category: (c.category as Consumable['category']) || undefined,
    mechanicKey: c.mechanicKey || undefined,
    quotaKind: (c.quotaKind as Consumable['quotaKind']) || undefined,
    useSpec: (c.useSpec as Consumable['useSpec']) || undefined,
    details: (c.details as Record<string, unknown>) || undefined,
  });
}

function mapMaterialRow(
  m: typeof schema.materials.$inferSelect,
): Cultivator['inventory']['materials'][number] {
  return {
    id: m.id,
    name: m.name,
    type: m.type as MaterialType,
    rank: m.rank as Quality,
    element: m.element as ElementType | undefined,
    description: m.description || '',
    details: (m.details as Record<string, unknown>) || undefined,
    quantity: m.quantity,
  };
}

export async function getCultivatorConsumables(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['inventory']['consumables']> {
  const result = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));

  return result.map(mapConsumableRow);
}

export async function getCultivatorMaterials(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['inventory']['materials']> {
  const result = await getExecutor()
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.cultivatorId, cultivatorId));

  return result.map(mapMaterialRow);
}

export async function getCultivatorArtifacts(
  userId: string,
  cultivatorId: string,
  tx?: DbTransaction,
): Promise<Cultivator['inventory']['artifacts']> {
  await assertCultivatorOwnership(userId, cultivatorId);
  const q = getExecutor(tx);
  const result = await creationProductRepository.findByTypeAndCultivator(
    cultivatorId,
    'artifact',
    q,
  );

  return result.map((artifact) =>
    mapArtifactRow(toArtifactFromProduct(artifact)),
  );
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
  },
): Promise<PaginatedInventoryResult<T>> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
  const offset = (page - 1) * pageSize;

  if (options.type === 'artifacts') {
    const countResult = await getExecutor()
      .select({ count: sql<number>`count(*)` })
      .from(schema.creationProducts)
      .where(
        and(
          eq(schema.creationProducts.cultivatorId, cultivatorId),
          eq(schema.creationProducts.productType, 'artifact'),
        ),
      );
    const total = Number(countResult[0]?.count || 0);

    const rows = await getExecutor()
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
      type: options.type,
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
    const countResult = await getExecutor()
      .select({ count: sql<number>`count(*)` })
      .from(schema.consumables)
      .where(eq(schema.consumables.cultivatorId, cultivatorId));
    const total = Number(countResult[0]?.count || 0);

    const rows = await getExecutor()
      .select()
      .from(schema.consumables)
      .where(eq(schema.consumables.cultivatorId, cultivatorId))
      .orderBy(desc(schema.consumables.createdAt), desc(schema.consumables.id))
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize);
    return {
      type: options.type,
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

  const materialRows = await getExecutor()
    .select()
    .from(schema.materials)
    .where(materialWhere);

  const sortBy = options.materialSortBy ?? 'createdAt';
  const sortOrder = options.materialSortOrder ?? 'desc';
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  const sortedMaterialRows = [...materialRows].sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case 'rank': {
        result =
          (QUALITY_ORDER[a.rank as Quality] ?? -1) -
          (QUALITY_ORDER[b.rank as Quality] ?? -1);
        break;
      }
      case 'type': {
        result = a.type.localeCompare(b.type, 'zh-CN');
        break;
      }
      case 'element': {
        result = (a.element || '').localeCompare(b.element || '', 'zh-CN');
        break;
      }
      case 'quantity': {
        result = a.quantity - b.quantity;
        break;
      }
      case 'name': {
        result = a.name.localeCompare(b.name, 'zh-CN');
        break;
      }
      case 'createdAt':
      default: {
        result = (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
        break;
      }
    }

    if (result === 0) {
      result = a.id.localeCompare(b.id);
    }

    return result * multiplier;
  });

  const total = sortedMaterialRows.length;
  const pagedRows = sortedMaterialRows.slice(offset, offset + pageSize);

  const totalPages = Math.ceil(total / pageSize);
  return {
    type: options.type,
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

// ===== 临时角色相关操作 =====

// ===== 物品栏和装备相关操作 =====

/**
 * 获取角色物品栏
 */
export async function getInventory(
  userId: string,
  cultivatorId: string,
): Promise<import('../../types/cultivator').Inventory> {
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

  // 获取法宝、消耗品和材料（串行）
  const artifactsResult = await getExecutor()
    .select()
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'artifact'),
      ),
    );
  const consumablesResult = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));
  const materialsResult = await getExecutor()
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.cultivatorId, cultivatorId));

  return {
    artifacts: artifactsResult.map(toArtifactFromProduct),
    consumables: consumablesResult.map(mapConsumableRow),
    materials: materialsResult.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type as MaterialType,
      rank: m.rank as Quality,
      element: m.element as ElementType | undefined,
      description: m.description || undefined,
      details: (m.details as Record<string, unknown>) || undefined,
      quantity: m.quantity,
    })),
  };
}

/**
 * 装备/卸下装备
 */
export async function equipEquipment(
  userId: string,
  cultivatorId: string,
  artifactId: string,
): Promise<import('../../types/cultivator').EquippedItems> {
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
 * 更新角色灵石数量
 */
export async function updateSpiritStones(
  userId: string,
  cultivatorId: string,
  delta: number,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  const cultivator = await dbInstance
    .select({ spirit_stones: schema.cultivators.spirit_stones })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  if (cultivator.length === 0) {
    throw new Error('修真者不存在');
  }

  const newValue = cultivator[0].spirit_stones + delta;
  if (newValue < 0) {
    throw new Error(
      `灵石不足，需要 ${-delta}，当前拥有 ${cultivator[0].spirit_stones}`,
    );
  }

  await dbInstance
    .update(schema.cultivators)
    .set({ spirit_stones: newValue })
    .where(eq(schema.cultivators.id, cultivatorId));
}

/**
 * 更新角色寿元
 */
export async function updateLifespan(
  userId: string,
  cultivatorId: string,
  delta: number,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  const cultivator = await dbInstance
    .select({ lifespan: schema.cultivators.lifespan })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  if (cultivator.length === 0) {
    throw new Error('修真者不存在');
  }

  const newValue = cultivator[0].lifespan + delta;
  if (newValue < 0) {
    throw new Error(
      `寿元不足，需要 ${-delta}，当前剩余 ${cultivator[0].lifespan}`,
    );
  }

  await dbInstance
    .update(schema.cultivators)
    .set({ lifespan: newValue })
    .where(eq(schema.cultivators.id, cultivatorId));
}

/**
 * 更新角色修为和感悟值
 * @param cultivationExpDelta 修为变化量（可为负数）
 * @param comprehensionInsightDelta 感悟值变化量（可选，可为负数）
 */
export async function updateCultivationExp(
  userId: string,
  cultivatorId: string,
  cultivationExpDelta: number,
  comprehensionInsightDelta?: number,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  const cultivatorData = await dbInstance
    .select({
      cultivation_progress: schema.cultivators.cultivation_progress,
      realm: schema.cultivators.realm,
      realm_stage: schema.cultivators.realm_stage,
    })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  if (cultivatorData.length === 0) {
    throw new Error('修真者不存在');
  }

  // 使用 getOrInitCultivationProgress 自动初始化
  const progress = getOrInitCultivationProgress(
    (cultivatorData[0].cultivation_progress as CultivationProgress | null) ||
      ({} as CultivationProgress),
    cultivatorData[0].realm as RealmType,
    cultivatorData[0].realm_stage as RealmStage,
  );

  // 计算新的修为值
  const newCultivationExp = progress.cultivation_exp + cultivationExpDelta;
  if (newCultivationExp < 0) {
    throw new Error(
      `修为不足，需要 ${-cultivationExpDelta}，当前修为 ${progress.cultivation_exp}`,
    );
  }

  // 计算新的感悟值（如果提供）
  let newComprehensionInsight = progress.comprehension_insight;
  if (comprehensionInsightDelta !== undefined) {
    newComprehensionInsight = Math.max(
      0,
      Math.min(100, progress.comprehension_insight + comprehensionInsightDelta),
    ); // 限制在 0-100 范围内
  }

  const updatedProgress: CultivationProgress = {
    ...progress,
    cultivation_exp: newCultivationExp,
    comprehension_insight: newComprehensionInsight,
  };

  await dbInstance
    .update(schema.cultivators)
    .set({ cultivation_progress: updatedProgress })
    .where(eq(schema.cultivators.id, cultivatorId));
}

/**
 * 检查角色是否拥有足够数量的材料
 */
export async function hasMaterial(
  userId: string,
  cultivatorId: string,
  materialName: string,
  quantity: number,
): Promise<boolean> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const materials = await getExecutor()
    .select()
    .from(schema.materials)
    .where(
      and(
        eq(schema.materials.cultivatorId, cultivatorId),
        eq(schema.materials.name, materialName),
      ),
    );

  if (materials.length === 0) {
    return false;
  }

  return materials[0].quantity >= quantity;
}

/**
 * 添加材料到物品栏（如果已存在则增加数量）
 */
export async function addMaterialToInventory(
  userId: string,
  cultivatorId: string,
  material: import('../../types/cultivator').Material,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  // 检查是否已经有相同的材料（名称和品质都必须一致）
  const existing = await dbInstance
    .select()
    .from(schema.materials)
    .where(
      and(
        eq(schema.materials.cultivatorId, cultivatorId),
        eq(schema.materials.name, material.name),
        eq(schema.materials.rank, material.rank),
      ),
    );

  if (existing.length > 0) {
    // 增加数量
    await dbInstance
      .update(schema.materials)
      .set({ quantity: existing[0].quantity + material.quantity })
      .where(eq(schema.materials.id, existing[0].id));
  } else {
    // 添加新材料
    await dbInstance.insert(schema.materials).values({
      cultivatorId,
      name: material.name,
      type: material.type,
      rank: material.rank,
      element: material.element || null,
      description: material.description || null,
      details: (material.details as Record<string, unknown>) || null,
      quantity: material.quantity,
    });
  }
}

/**
 * 从物品栏移除材料
 */
export async function removeMaterialFromInventory(
  userId: string,
  cultivatorId: string,
  materialName: string,
  quantity: number,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

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

  if (materials.length === 0) {
    throw new Error(`材料 ${materialName} 不存在`);
  }

  const material = materials[0];
  if (material.quantity < quantity) {
    throw new Error(
      `材料 ${materialName} 不足，需要 ${quantity}，当前拥有 ${material.quantity}`,
    );
  }

  if (material.quantity === quantity) {
    // 删除材料
    await dbInstance
      .delete(schema.materials)
      .where(eq(schema.materials.id, material.id));
  } else {
    // 减少数量
    await dbInstance
      .update(schema.materials)
      .set({ quantity: material.quantity - quantity })
      .where(eq(schema.materials.id, material.id));
  }
}

/**
 * 添加法宝到物品栏
 */
export async function addArtifactToInventory(
  userId: string,
  cultivatorId: string,
  artifact: import('../../types/cultivator').Artifact,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  const score = calculateSingleArtifactScore(artifact);
  const abilityConfig =
    artifact.abilityConfig ||
    ({
      slug: `artifact_${artifact.name}`,
      name: artifact.name,
      type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.ARTIFACT],
      modifiers: artifact.attributeModifiers ?? [],
      effects: [],
      listeners: [],
    } as AbilityConfig);

  await creationProductRepository.insert(
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
      abilityConfig: serializeAbilityConfig(abilityConfig),
      productModel: serializeProductModel({ affixes: [] } as Record<
        string,
        unknown
      > as never),
    },
    dbInstance,
  );
}

/**
 * 添加消耗品到物品栏（如果已存在则增加数量）
 */
export async function addConsumableToInventory(
  userId: string,
  cultivatorId: string,
  consumable: Consumable,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  const normalizedConsumable = ConsumableRegistry.normalizeConsumable(consumable);
  const score = calculateSingleElixirScore(normalizedConsumable);
  // 检查是否已经有相同的消耗品（名称和品质都必须一致）
  const quality = normalizedConsumable.quality || '凡品';
  const existing = await dbInstance
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.name, normalizedConsumable.name),
        eq(schema.consumables.quality, quality),
      ),
    );

  if (existing.length > 0) {
    // 增加数量
    await dbInstance
      .update(schema.consumables)
      .set({
        quantity: existing[0].quantity + normalizedConsumable.quantity,
        // 兼容旧数据可能存在的 0 分，合并时取更高评分
        score: Math.max(existing[0].score || 0, score),
        prompt: normalizedConsumable.prompt || existing[0].prompt || '',
        category: normalizedConsumable.category || existing[0].category || null,
        mechanicKey:
          normalizedConsumable.mechanicKey || existing[0].mechanicKey || null,
        quotaKind:
          normalizedConsumable.quotaKind || existing[0].quotaKind || null,
        useSpec:
          (normalizedConsumable.useSpec as Record<string, unknown>) ||
          existing[0].useSpec ||
          null,
        details:
          (normalizedConsumable.details as Record<string, unknown>) ||
          existing[0].details ||
          null,
        description:
          normalizedConsumable.description ||
          existing[0].description ||
          null,
      })
      .where(eq(schema.consumables.id, existing[0].id));
  } else {
    // 添加新消耗品
    await dbInstance.insert(schema.consumables).values({
      cultivatorId,
      name: normalizedConsumable.name,
      type: normalizedConsumable.type,
      category: normalizedConsumable.category || null,
      prompt: normalizedConsumable.prompt || '',
      quality: quality,
      mechanicKey: normalizedConsumable.mechanicKey || null,
      quotaKind: normalizedConsumable.quotaKind || null,
      useSpec:
        (normalizedConsumable.useSpec as Record<string, unknown>) || null,
      quantity: normalizedConsumable.quantity,
      description: normalizedConsumable.description || null,
      score,
      details:
        (normalizedConsumable.details as Record<string, unknown>) || null,
    });
  }
}

export async function replaceSpiritualRoots(
  userId: string,
  cultivatorId: string,
  spiritualRoots: Cultivator['spiritual_roots'],
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
  await dbInstance
    .delete(schema.spiritualRoots)
    .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId));

  if (spiritualRoots.length === 0) {
    return;
  }

  const rootCount = spiritualRoots.length;
  await dbInstance.insert(schema.spiritualRoots).values(
    spiritualRoots.map((root) => ({
      cultivatorId,
      element: root.element,
      strength: root.strength,
      grade: root.grade ?? resolveSpiritualRootGrade(rootCount, root.element),
    })),
  );
}

export async function consumeConsumableById(
  userId: string,
  cultivatorId: string,
  consumableId: string,
  quantity: number,
  tx?: DbTransaction,
): Promise<void> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const dbInstance = getExecutor(tx);
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
    return;
  }

  await dbInstance
    .update(schema.consumables)
    .set({ quantity: existing.quantity - quantity })
    .where(eq(schema.consumables.id, existing.id));
}

/**
 * 更新角色上次领取收益时间（内部版本，用于事务中）
 * 跳过权限检查，由调用方保证权限
 */
async function updateLastYieldAtTx(
  cultivatorId: string,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .update(schema.cultivators)
    .set({ last_yield_at: new Date() })
    .where(eq(schema.cultivators.id, cultivatorId));
}

/**
 * 更新角色上次领取收益时间（公开版本）
 * 包含权限检查
 */
export async function updateLastYieldAt(
  userId: string,
  cultivatorId: string,
  tx?: DbTransaction,
): Promise<void> {
  // 如果传入了事务，使用内部版本跳过权限检查
  if (tx) {
    await updateLastYieldAtTx(cultivatorId, tx);
    return;
  }

  // 否则进行完整的权限检查
  await assertCultivatorOwnership(userId, cultivatorId);
  await getExecutor()
    .update(schema.cultivators)
    .set({ last_yield_at: new Date() })
    .where(eq(schema.cultivators.id, cultivatorId));
}
