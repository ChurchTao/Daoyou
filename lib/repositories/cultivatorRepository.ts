import { BuffInstanceState } from '@/engine/buff/types';
import { EffectConfig } from '@/engine/effect/types';
import {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  GenderType,
  MaterialType,
  Quality,
  RealmStage,
  RealmType,
  SkillGrade,
  SpiritualRootGrade,
} from '@/types/constants';
import type {
  BreakthroughHistoryEntry,
  Consumable,
  CultivationProgress,
  Cultivator,
  Material,
  RetreatRecord,
} from '@/types/cultivator';
import { getOrInitCultivationProgress } from '@/utils/cultivationUtils';
import { and, eq, inArray } from 'drizzle-orm';
import {
  getExecutor,
  getQueryConcurrency,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import * as schema from '../drizzle/schema';

type CultivatorRecord = typeof schema.cultivators.$inferSelect;
type SpiritualRootRecord = typeof schema.spiritualRoots.$inferSelect;
type PreHeavenFateRecord = typeof schema.preHeavenFates.$inferSelect;
type CultivationTechniqueRecord = typeof schema.cultivationTechniques.$inferSelect;
type SkillRecord = typeof schema.skills.$inferSelect;
type EquippedItemRecord = typeof schema.equippedItems.$inferSelect;
type ArtifactRecord = typeof schema.artifacts.$inferSelect;

interface CultivatorRelations {
  spiritualRoots: SpiritualRootRecord[];
  preHeavenFates: PreHeavenFateRecord[];
  cultivations: CultivationTechniqueRecord[];
  skills: SkillRecord[];
  equippedItems: EquippedItemRecord[];
  artifacts: ArtifactRecord[];
}

type CultivatorRelationBuckets = Record<string, CultivatorRelations>;

function shouldUseBatchAssembly(): boolean {
  return process.env.DB_BATCH_ASSEMBLY !== '0';
}

function createEmptyRelations(): CultivatorRelations {
  return {
    spiritualRoots: [],
    preHeavenFates: [],
    cultivations: [],
    skills: [],
    equippedItems: [],
    artifacts: [],
  };
}

function buildRelationBuckets(cultivatorIds: string[]): CultivatorRelationBuckets {
  const buckets: CultivatorRelationBuckets = {};
  for (const id of cultivatorIds) {
    buckets[id] = createEmptyRelations();
  }
  return buckets;
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  if (tasks.length === 0) {
    return;
  }

  const maxWorkers = Math.max(1, Math.min(concurrency, tasks.length));
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      await task();
    }
  };

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
}

async function loadCultivatorRelationsBatch(
  q: DbExecutor,
  cultivatorIds: string[],
): Promise<CultivatorRelationBuckets> {
  const buckets = buildRelationBuckets(cultivatorIds);
  if (cultivatorIds.length === 0) {
    return buckets;
  }

  const concurrency = getQueryConcurrency();
  const tasks: Array<() => Promise<void>> = [
    async () => {
      const roots = await q
        .select()
        .from(schema.spiritualRoots)
        .where(inArray(schema.spiritualRoots.cultivatorId, cultivatorIds));
      for (const root of roots) {
        buckets[root.cultivatorId]?.spiritualRoots.push(root);
      }
    },
    async () => {
      const fates = await q
        .select()
        .from(schema.preHeavenFates)
        .where(inArray(schema.preHeavenFates.cultivatorId, cultivatorIds));
      for (const fate of fates) {
        buckets[fate.cultivatorId]?.preHeavenFates.push(fate);
      }
    },
    async () => {
      const cultivations = await q
        .select()
        .from(schema.cultivationTechniques)
        .where(inArray(schema.cultivationTechniques.cultivatorId, cultivatorIds));
      for (const cultivation of cultivations) {
        buckets[cultivation.cultivatorId]?.cultivations.push(cultivation);
      }
    },
    async () => {
      const skills = await q
        .select()
        .from(schema.skills)
        .where(inArray(schema.skills.cultivatorId, cultivatorIds));
      for (const skill of skills) {
        buckets[skill.cultivatorId]?.skills.push(skill);
      }
    },
    async () => {
      const equipped = await q
        .select()
        .from(schema.equippedItems)
        .where(inArray(schema.equippedItems.cultivatorId, cultivatorIds));
      for (const row of equipped) {
        buckets[row.cultivatorId]?.equippedItems.push(row);
      }
    },
    async () => {
      const artifacts = await q
        .select()
        .from(schema.artifacts)
        .where(inArray(schema.artifacts.cultivatorId, cultivatorIds));
      for (const artifact of artifacts) {
        buckets[artifact.cultivatorId]?.artifacts.push(artifact);
      }
    },
  ];

  await runWithConcurrency(tasks, concurrency);
  return buckets;
}

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
  const relationBuckets = await loadCultivatorRelationsBatch(q, [cultivatorRecord.id]);
  return assembleCultivatorFromRelations(
    cultivatorRecord,
    relationBuckets[cultivatorRecord.id] ?? createEmptyRelations(),
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
  const q = getExecutor();
  const record = await q
    .select({
      id: schema.cultivators.id,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  if (record.length === 0) {
    return null;
  }

  return record[0].id;
}

/**
 * 根据 ID 获取角色
 */
export async function getCultivatorById(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator | null> {
  const q = getExecutor();
  const cultivatorRecord = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  if (cultivatorRecord.length === 0) {
    return null;
  }

  return assembleCultivator(cultivatorRecord[0], userId, q);
}

/**
 * 获取用户的所有角色
 */
export async function getCultivatorsByUserId(
  userId: string,
): Promise<Cultivator[]> {
  const q = getExecutor();
  const cultivatorRecords = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    );

  const relationBuckets = shouldUseBatchAssembly()
    ? await loadCultivatorRelationsBatch(
        q,
        cultivatorRecords.map((record) => record.id),
      )
    : undefined;

  const cultivators: Array<Cultivator | null> = [];
  for (const record of cultivatorRecords) {
    const cultivator = await assembleCultivator(
      record,
      userId,
      q,
      relationBuckets
        ? relationBuckets[record.id] ?? createEmptyRelations()
        : undefined,
    );
    cultivators.push(cultivator);
  }

  return cultivators.filter((c): c is Cultivator => c !== null);
}

export async function hasDeadCultivator(userId: string): Promise<boolean> {
  const q = getExecutor();
  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'dead'),
      ),
    )
    .limit(1);
  return rows.length > 0;
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
  const q = getExecutor();
  const record = await q
    .select({
      userId: schema.cultivators.userId,
      status: schema.cultivators.status,
    })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  if (record.length === 0 || record[0].status !== 'active') {
    return null;
  }

  return record[0].userId;
}

/**
 * 根据ID获取角色（系统用途，不做用户匹配校验）
 */
export async function getCultivatorByIdUnsafe(
  cultivatorId: string,
): Promise<CultivatorWithOwner | null> {
  const q = getExecutor();
  const record = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  if (record.length === 0) {
    return null;
  }

  const full = await assembleCultivator(record[0], record[0].userId, q);
  if (!full) {
    return null;
  }

  return {
    cultivator: full,
    userId: record[0].userId,
    updatedAt: record[0].updatedAt,
  };
}

/**
 * 批量获取角色（系统用途，不做用户匹配校验）
 */
export async function getCultivatorsByIdsUnsafe(
  cultivatorIds: string[],
): Promise<CultivatorWithOwner[]> {
  if (cultivatorIds.length === 0) {
    return [];
  }

  const q = getExecutor();
  const records = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        inArray(schema.cultivators.id, cultivatorIds),
        eq(schema.cultivators.status, 'active'),
      ),
    );

  const relationBuckets = shouldUseBatchAssembly()
    ? await loadCultivatorRelationsBatch(
        q,
        records.map((record) => record.id),
      )
    : undefined;

  const assembled: Array<CultivatorWithOwner | null> = [];
  for (const record of records) {
    const full = await assembleCultivator(
      record,
      record.userId,
      q,
      relationBuckets
        ? relationBuckets[record.id] ?? createEmptyRelations()
        : undefined,
    );
    if (!full) {
      assembled.push(null);
      continue;
    }
    assembled.push({
      cultivator: full,
      userId: record.userId,
      updatedAt: record.updatedAt,
    });
  }

  return assembled.filter((item): item is CultivatorWithOwner => item !== null);
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
  // 权限验证
  const existing = await getExecutor()
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(and(eq(schema.cultivators.id, cultivatorId)));

  if (existing.length === 0) {
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
  const existing = await getExecutor()
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
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

export async function getCultivatorConsumables(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['inventory']['consumables']> {
  const result = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));

  return result.map((c) => ({
    id: c.id,
    name: c.name,
    quality: c.quality as Quality,
    type: c.type as ConsumableType,
    effects: c.effects as EffectConfig[],
    quantity: c.quantity,
    description: c.description || '',
  }));
}

export async function getCultivatorMaterials(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['inventory']['materials']> {
  const result = await getExecutor()
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.cultivatorId, cultivatorId));

  return result.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type as MaterialType,
    rank: m.rank as Quality,
    element: m.element as ElementType | undefined,
    description: m.description || '',
    details: (m.details as Record<string, unknown>) || undefined,
    quantity: m.quantity,
  }));
}

export async function getCultivatorRetreatRecords(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['retreat_records']> {
  const result = await getExecutor()
    .select()
    .from(schema.retreatRecords)
    .where(eq(schema.retreatRecords.cultivatorId, cultivatorId))
    .orderBy(schema.retreatRecords.timestamp);

  return result.map((record) => ({
    realm: record.realm as Cultivator['realm'],
    realm_stage: record.realm_stage as Cultivator['realm_stage'],
    years: record.years,
    success: record.success ?? false,
    chance: record.chance,
    roll: record.roll,
    timestamp: record.timestamp
      ? record.timestamp.toISOString()
      : new Date().toISOString(),
    modifiers: record.modifiers as RetreatRecord['modifiers'],
  }));
}

export async function getCultivatorBreakthroughHistory(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['breakthrough_history']> {
  const result = await getExecutor()
    .select()
    .from(schema.breakthroughHistory)
    .where(eq(schema.breakthroughHistory.cultivatorId, cultivatorId))
    .orderBy(schema.breakthroughHistory.createdAt);

  return result.map((entry) => ({
    from_realm: entry.from_realm as Cultivator['realm'],
    from_stage: entry.from_stage as Cultivator['realm_stage'],
    to_realm: entry.to_realm as Cultivator['realm'],
    to_stage: entry.to_stage as Cultivator['realm_stage'],
    age: entry.age,
    years_spent: entry.years_spent,
    story: entry.story ?? undefined,
  }));
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

  return result.map((a) => ({
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

/**
 * 获取角色技能
 */
export async function getSkills(
  userId: string,
  cultivatorId: string,
): Promise<import('../../types/cultivator').Skill[]> {
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

  // 获取技能列表
  const skillsResult = await getExecutor()
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.cultivatorId, cultivatorId));

  return skillsResult.map((skill) => ({
    id: skill.id,
    name: skill.name,
    element: skill.element as ElementType,
    grade: skill.grade as SkillGrade | undefined,
    cost: skill.cost || undefined,
    cooldown: skill.cooldown,
    target_self: skill.target_self === 1 ? true : undefined,
    description: skill.description || undefined,
    effects: skill.effects as EffectConfig[],
  }));
}

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
