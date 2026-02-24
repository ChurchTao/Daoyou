import { BuffInstanceState } from '@/engine/buff/types';
import { EffectConfig } from '@/engine/effect/types';
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
  SkillGrade,
  SpiritualRootGrade,
} from '@/types/constants';
import type {
  Artifact,
  BreakthroughHistoryEntry,
  Consumable,
  CultivationProgress,
  Cultivator,
  Material,
  RetreatRecord,
} from '@/types/cultivator';
import { getOrInitCultivationProgress } from '@/utils/cultivationUtils';
import { and, desc, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
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
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import * as schema from '../drizzle/schema';

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

  const pre_heaven_fates = relations.preHeavenFates.map((f) => ({
    name: f.name,
    quality: f.quality as Quality,
    effects: (f.effects ?? []) as EffectConfig[],
    description: f.description || undefined,
  }));

  const cultivations = relations.cultivations.map((c) => ({
    id: c.id,
    name: c.name,
    grade: c.grade as SkillGrade | undefined,
    required_realm: c.required_realm as RealmType,
    effects: (c.effects ?? []) as EffectConfig[],
    description: c.description || undefined,
  }));

  const skills = relations.skills.map((s) => ({
    id: s.id,
    name: s.name,
    element: s.element as ElementType,
    grade: s.grade as SkillGrade | undefined,
    cost: s.cost || undefined,
    cooldown: s.cooldown,
    target_self: s.target_self === 1 ? true : undefined,
    description: s.description || undefined,
    effects: (s.effects ?? []) as EffectConfig[],
  }));

  const artifacts = relations.artifacts.map((a) => ({
    id: a.id,
    name: a.name,
    slot: a.slot as Cultivator['inventory']['artifacts'][0]['slot'],
    element: a.element as Cultivator['inventory']['artifacts'][0]['element'],
    quality: a.quality as
      | Cultivator['inventory']['artifacts'][0]['quality']
      | undefined,
    required_realm: a.required_realm as
      | Cultivator['inventory']['artifacts'][0]['required_realm']
      | undefined,
    description: a.description || '',
    effects: (a.effects ??
      []) as Cultivator['inventory']['artifacts'][0]['effects'],
  }));

  const equippedRow = relations.equippedItems[0];
  const equipped: Cultivator['equipped'] = {
    weapon: equippedRow?.weapon_id ? String(equippedRow.weapon_id) : null,
    armor: equippedRow?.armor_id ? String(equippedRow.armor_id) : null,
    accessory: equippedRow?.accessory_id ? String(equippedRow.accessory_id) : null,
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
      (cultivatorRecord.persistent_statuses as Cultivator['persistent_statuses']) ||
      [],
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
    return assembleCultivatorFromRelations(cultivatorRecord, prefetchedRelations);
  }

  const q = executor ?? getExecutor();
  const relations = await loadCultivatorRelations(q, cultivatorRecord.id);
  return assembleCultivatorFromRelations(
    cultivatorRecord,
    relations,
  );
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
      (cultivatorRecord.persistent_statuses as Cultivator['persistent_statuses']) ||
      [],
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
    if (cultivator.pre_heaven_fates.length > 0) {
      await tx.insert(schema.preHeavenFates).values(
        cultivator.pre_heaven_fates.map((fate) => ({
          cultivatorId,
          name: fate.name,
          quality: fate.quality || null,
          effects: fate.effects ?? [],
          description: fate.description || null,
        })),
      );
    }

    // 4. 创建功法
    if (cultivator.cultivations.length > 0) {
      await tx.insert(schema.cultivationTechniques).values(
        cultivator.cultivations.map((cult) => ({
          cultivatorId,
          name: cult.name,
          grade: cult.grade || null,
          required_realm: cult.required_realm,
          effects: cult.effects ?? [],
        })),
      );
    }

    // 5. 创建技能
    if (cultivator.skills.length > 0) {
      await tx.insert(schema.skills).values(
        cultivator.skills.map((skill) => ({
          cultivatorId,
          name: skill.name,
          element: skill.element,
          grade: skill.grade || null,
          cost: skill.cost || 0,
          cooldown: skill.cooldown,
          target_self: skill.target_self ? 1 : 0,
          description: skill.description || null,
          effects: skill.effects ?? [],
        })),
      );
    }

    // 6. 创建装备状态表（初始为空）
    await tx.insert(schema.equippedItems).values({
      cultivatorId,
      weapon_id: null,
      armor_id: null,
      accessory_id: null,
    });

    // 注意：artifacts 和 consumables 不在创建时生成，由用户后续手动添加

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
  const record = await findCultivatorOwnerStatusById(cultivatorId, getExecutor());
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
  a: typeof schema.artifacts.$inferSelect,
): Cultivator['inventory']['artifacts'][number] {
  return {
    id: a.id,
    name: a.name,
    slot: a.slot as Artifact['slot'],
    element: a.element as Artifact['element'],
    quality: a.quality as Artifact['quality'],
    required_realm: a.required_realm as Artifact['required_realm'],
    description: a.description || '',
    effects: (a.effects ?? []) as Artifact['effects'],
  };
}

function mapConsumableRow(
  c: typeof schema.consumables.$inferSelect,
): Cultivator['inventory']['consumables'][number] {
  return {
    id: c.id,
    name: c.name,
    quality: c.quality as Quality,
    type: c.type as ConsumableType,
    effects: (Array.isArray(c.effects)
      ? c.effects
      : [c.effects].filter(Boolean)) as EffectConfig[],
    quantity: c.quantity,
    description: c.description || '',
  };
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
  const q = getExecutor(tx);
  const result = await q
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.cultivatorId, cultivatorId));

  return result.map(mapArtifactRow);
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
      .from(schema.artifacts)
      .where(eq(schema.artifacts.cultivatorId, cultivatorId));
    const total = Number(countResult[0]?.count || 0);

    const rows = await getExecutor()
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.cultivatorId, cultivatorId))
      .orderBy(desc(schema.artifacts.createdAt), desc(schema.artifacts.id))
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize);
    return {
      type: options.type,
      items: rows.map(mapArtifactRow) as InventoryItemByType[T][],
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
        result =
          (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
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
    .from(schema.artifacts)
    .where(eq(schema.artifacts.cultivatorId, cultivatorId));
  const consumablesResult = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));
  const materialsResult = await getExecutor()
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.cultivatorId, cultivatorId));

  return {
    artifacts: artifactsResult.map((a) => ({
      id: a.id,
      name: a.name,
      slot: a.slot as EquipmentSlot,
      element: a.element as ElementType,
      effects: a.effects as EffectConfig[],
    })),
    consumables: consumablesResult.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as ConsumableType,
      quality: c.quality as Quality | undefined,
      effects: (Array.isArray(c.effects)
        ? c.effects
        : [c.effects].filter(Boolean)) as EffectConfig[],
      quantity: c.quantity,
    })),
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
  const artifact = await getExecutor()
    .select()
    .from(schema.artifacts)
    .where(
      and(
        eq(schema.artifacts.cultivatorId, cultivatorId),
        eq(schema.artifacts.id, artifactId),
      ),
    );

  if (artifact.length === 0) {
    throw new Error('装备不存在或无权限操作');
  }

  const artifactItem = artifact[0];
  const slot = artifactItem.slot;

  // 获取当前装备状态
  const equippedItems = await getExecutor()
    .select()
    .from(schema.equippedItems)
    .where(eq(schema.equippedItems.cultivatorId, cultivatorId));

  let equippedItem;
  if (equippedItems.length === 0) {
    // 如果没有装备状态记录，创建一个
    const newEquipped = await getExecutor()
      .insert(schema.equippedItems)
      .values({
        cultivatorId,
        weapon_id: null,
        armor_id: null,
        accessory_id: null,
      })
      .returning();
    equippedItem = newEquipped[0];
  } else {
    equippedItem = equippedItems[0];
  }

  // 装备或卸下装备
  const slotField = `${slot}_id` as 'weapon_id' | 'armor_id' | 'accessory_id';
  const currentId = equippedItem[slotField];

  const updateData: Partial<typeof schema.equippedItems.$inferInsert> = {};
  if (currentId === artifactId) {
    // 卸下装备
    updateData[slotField] = null;
  } else {
    // 装备新装备，替换旧装备（artifactId 是字符串 UUID）
    updateData[slotField] = artifactId as string & { __brand: 'uuid' };
  }

  // 更新装备状态
  const updated = await getExecutor()
    .update(schema.equippedItems)
    .set(updateData)
    .where(eq(schema.equippedItems.id, equippedItem.id))
    .returning();

  return {
    weapon: updated[0].weapon_id ? String(updated[0].weapon_id) : null,
    armor: updated[0].armor_id ? String(updated[0].armor_id) : null,
    accessory: updated[0].accessory_id ? String(updated[0].accessory_id) : null,
  };
}

// ===== 技能相关操作 =====

// ===== 装备相关操作 =====

/**
 * 使用消耗品（类型分发入口）
 * 使用效果引擎统一处理所有消耗品效果
 */
export async function consumeItem(
  userId: string,
  cultivatorId: string,
  consumableId: string,
): Promise<{ success: boolean; message: string; cultivator: Cultivator }> {
  await assertCultivatorOwnership(userId, cultivatorId);

  const consumableRows = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.id, consumableId));

  if (consumableRows.length === 0) {
    throw new Error('消耗品不存在或已使用');
  }

  const item = consumableRows[0];
  if (item.cultivatorId !== cultivatorId) {
    throw new Error('消耗品不属于该道友');
  }

  // 只查询角色主表，避免关联表查询
  const cultivatorRows = await getExecutor()
    .select()
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  if (cultivatorRows.length === 0) {
    throw new Error('道友不存在');
  }

  const cultivatorRecord = cultivatorRows[0];

  // 创建最小化的 Cultivator 对象，仅包含效果引擎需要的字段
  const cultivator = createMinimalCultivator(cultivatorRecord);

  // 读取效果配置
  const effects = (item.effects ?? []) as EffectConfig[];

  if (effects.length === 0) {
    // 即使无效也消耗掉
    await handleConsumeItem(item.id, item.quantity);
    return {
      success: false,
      message: '此消耗品灵气尽失，使用后毫无反应。',
      cultivator: (await getCultivatorById(userId, cultivatorId))!,
    };
  }

  // 使用事务处理效果应用和数量扣减
  let finalMessage = `使用了【${item.name}】`;

  await getExecutor().transaction(async (tx) => {
    // 创建效果实例
    const { EffectFactory } = await import('@/engine/effect/EffectFactory');
    const { EffectTrigger } = await import('@/engine/effect/types');
    const { CultivatorAdapter } =
      await import('@/engine/effect/CultivatorAdapter');
    const { EffectLogCollector } = await import('@/engine/effect/types');

    // 创建适配器
    const adapter = new CultivatorAdapter(cultivator);

    // 创建日志收集器
    const logCollector = new EffectLogCollector();

    // 获取当前的持久状态
    const currentStatuses = (cultivator.persistent_statuses ||
      []) as BuffInstanceState[];

    // 创建效果实例数组
    const effectInstances = effects.map((config) =>
      EffectFactory.create(config),
    );

    // 构建效果上下文
    const ctx = {
      source: adapter,
      target: adapter,
      trigger: EffectTrigger.ON_CONSUME,
      value: 0,
      metadata: {
        tx,
        consumableName: item.name,
        persistent_statuses: currentStatuses,
        newBuffs: [] as BuffInstanceState[],
      },
      logCollector,
    };

    // 依次执行每个效果
    for (const effect of effectInstances) {
      // 检查触发时机
      if (effect.trigger !== EffectTrigger.ON_CONSUME) {
        console.warn(`[consumeItem] 效果触发时机不匹配: ${effect.trigger}`);
        continue;
      }

      effect.apply(ctx);
    }

    // 收集日志
    const logs = logCollector.getLogMessages();
    if (logs.length > 0) {
      finalMessage = logs.join('，');
    }

    // 获取更新后的数据
    const updatedCultivator = adapter.getData();

    // 处理新添加的持久 Buff
    const newBuffs = (ctx.metadata?.newBuffs as BuffInstanceState[]) || [];
    let updatedStatuses = currentStatuses;
    if (newBuffs.length > 0) {
      updatedStatuses = [...currentStatuses, ...newBuffs];
    }

    // 获取待处理的修为、感悟、寿元值
    const metadata = ctx.metadata as Record<string, unknown>;
    const pendingCultivationExp =
      (metadata.pendingCultivationExp as number) || 0;
    const pendingComprehension = (metadata.pendingComprehension as number) || 0;
    const pendingLifespan = (metadata.pendingLifespan as number) || 0;

    // 更新 cultivation_progress（修为和感悟）
    let finalCultivationProgress = updatedCultivator.cultivation_progress;
    if (pendingCultivationExp > 0 || pendingComprehension > 0) {
      const progress = getOrInitCultivationProgress(
        (updatedCultivator.cultivation_progress as CultivationProgress | null) ||
          ({} as CultivationProgress),
        cultivator.realm as RealmType,
        cultivator.realm_stage as RealmStage,
      );

      // 更新修为和感悟
      progress.cultivation_exp += pendingCultivationExp;
      progress.comprehension_insight += pendingComprehension;

      finalCultivationProgress = progress;
    }

    // 更新寿元
    let finalLifespan = updatedCultivator.lifespan || 0;
    if (pendingLifespan > 0) {
      finalLifespan = finalLifespan + pendingLifespan;
    }

    // 持久化所有变更
    await tx
      .update(schema.cultivators)
      .set({
        vitality: Math.round(updatedCultivator.attributes.vitality),
        spirit: Math.round(updatedCultivator.attributes.spirit),
        wisdom: Math.round(updatedCultivator.attributes.wisdom),
        speed: Math.round(updatedCultivator.attributes.speed),
        willpower: Math.round(updatedCultivator.attributes.willpower),
        cultivation_progress: finalCultivationProgress,
        lifespan: finalLifespan,
        persistent_statuses: updatedStatuses,
      })
      .where(eq(schema.cultivators.id, cultivatorId));

    // 消耗数量
    await handleConsumeItemTx(tx, item.id, item.quantity);
  });

  // 只在最后查询一次完整数据用于返回
  return {
    success: true,
    message: finalMessage,
    cultivator: (await getCultivatorById(userId, cultivatorId))!,
  };
}

/**
 * 处理消耗品消耗（事务版本）
 */
async function handleConsumeItemTx(
  tx: DbTransaction,
  itemId: string,
  quantity: number,
) {
  if (quantity > 1) {
    await tx
      .update(schema.consumables)
      .set({ quantity: quantity - 1 })
      .where(eq(schema.consumables.id, itemId));
  } else {
    await tx
      .delete(schema.consumables)
      .where(eq(schema.consumables.id, itemId));
  }
}

async function handleConsumeItem(
  itemId: string,
  currentQuantity: number,
  tx?: DbTransaction,
) {
  const dbInstance = getExecutor(tx);
  if (currentQuantity > 1) {
    await dbInstance
      .update(schema.consumables)
      .set({ quantity: currentQuantity - 1 })
      .where(eq(schema.consumables.id, itemId));
  } else {
    await dbInstance
      .delete(schema.consumables)
      .where(eq(schema.consumables.id, itemId));
  }
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
  await dbInstance.insert(schema.artifacts).values({
    cultivatorId,
    name: artifact.name,
    slot: artifact.slot,
    element: artifact.element,
    prompt: '', // 默认空提示词
    quality: artifact.quality || '凡品',
    required_realm: artifact.required_realm || '炼气',
    description: artifact.description || null,
    score: 0, // 默认评分
    effects: artifact.effects || [],
  });
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
  // 检查是否已经有相同的消耗品（名称和品质都必须一致）
  const quality = consumable.quality || '凡品';
  const existing = await dbInstance
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.name, consumable.name),
        eq(schema.consumables.quality, quality),
      ),
    );

  if (existing.length > 0) {
    // 增加数量
    await dbInstance
      .update(schema.consumables)
      .set({ quantity: existing[0].quantity + consumable.quantity })
      .where(eq(schema.consumables.id, existing[0].id));
  } else {
    // 添加新消耗品
    await dbInstance.insert(schema.consumables).values({
      cultivatorId,
      name: consumable.name,
      type: consumable.type,
      prompt: '', // 默认空提示词
      quality: quality,
      effects: consumable.effects || [],
      quantity: consumable.quantity,
      description: consumable.description || null,
      score: 0, // 默认评分
    });
  }
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
