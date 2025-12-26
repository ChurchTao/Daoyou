import {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  MaterialType,
  Quality,
  SkillGrade,
  SkillType,
  StatusEffect,
} from '@/types/constants';
import { getOrInitCultivationProgress } from '@/utils/cultivationUtils';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import type {
  BreakthroughHistoryEntry,
  ConsumableEffect,
  CultivationProgress,
  Cultivator,
  RetreatRecord,
} from '../../types/cultivator';
import { getRealmStageAttributeCap } from '../../utils/cultivatorUtils';
import { db } from '../drizzle/db';
import * as schema from '../drizzle/schema';

/**
 * 将数据库记录组装成完整的 Cultivator 对象
 */
async function assembleCultivator(
  cultivatorRecord: typeof schema.cultivators.$inferSelect,
  userId: string,
): Promise<Cultivator | null> {
  if (cultivatorRecord.userId !== userId) {
    return null; // 权限检查
  }

  const cultivatorId = cultivatorRecord.id;

  // 并行获取所有关联数据 (仅核心数据)
  const [
    spiritualRootsResult,
    preHeavenFatesResult,
    cultivationsResult,
    skillsResult,
    equippedResult,
  ] = await Promise.all([
    db
      .select()
      .from(schema.spiritualRoots)
      .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.preHeavenFates)
      .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.cultivationTechniques)
      .where(eq(schema.cultivationTechniques.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.equippedItems)
      .where(eq(schema.equippedItems.cultivatorId, cultivatorId)),
  ]);

  // 组装灵根
  const spiritual_roots = spiritualRootsResult.map((r) => ({
    element: r.element as Cultivator['spiritual_roots'][0]['element'],
    strength: r.strength,
    grade: r.grade as Cultivator['spiritual_roots'][0]['grade'] | undefined,
  }));

  // 组装先天命格
  const pre_heaven_fates = preHeavenFatesResult.map((f) => ({
    name: f.name,
    type: f.type as '吉' | '凶',
    quality: f.quality as
      | Cultivator['pre_heaven_fates'][0]['quality']
      | undefined,
    attribute_mod:
      f.attribute_mod as Cultivator['pre_heaven_fates'][0]['attribute_mod'],
    description: f.description || undefined,
  }));

  // 组装功法
  const cultivations = cultivationsResult.map((c) => ({
    name: c.name,
    grade: c.grade as Cultivator['cultivations'][0]['grade'] | undefined,
    bonus: c.bonus as Cultivator['cultivations'][0]['bonus'],
    required_realm:
      c.required_realm as Cultivator['cultivations'][0]['required_realm'],
  }));

  // 组装技能（使用数据库 UUID 作为 id）
  const skills = skillsResult.map((s) => ({
    id: s.id, // 使用数据库生成的 UUID
    name: s.name,
    type: s.type as Cultivator['skills'][0]['type'],
    element: s.element as Cultivator['skills'][0]['element'],
    grade: s.grade as Cultivator['skills'][0]['grade'] | undefined,
    power: s.power,
    cost: s.cost || undefined,
    cooldown: s.cooldown,
    effect: s.effect as Cultivator['skills'][0]['effect'] | undefined,
    duration: s.duration || undefined,
    target_self: s.target_self === 1 ? true : undefined,
    description: s.description || undefined,
  }));

  // 组装法宝 - 延迟加载
  const artifacts = await getCultivatorArtifacts(userId, cultivatorId);

  // 组装消耗品 - 延迟加载
  const consumables: Cultivator['inventory']['consumables'] = [];

  // 组装材料 - 延迟加载
  const materials: Cultivator['inventory']['materials'] = [];

  const retreat_records: Cultivator['retreat_records'] = undefined;

  const breakthrough_history: Cultivator['breakthrough_history'] = undefined;

  // 组装装备状态（将 UUID 转换为字符串）
  const equipped: Cultivator['equipped'] = {
    weapon: equippedResult[0]?.weapon_id
      ? String(equippedResult[0].weapon_id)
      : null,
    armor: equippedResult[0]?.armor_id
      ? String(equippedResult[0].armor_id)
      : null,
    accessory: equippedResult[0]?.accessory_id
      ? String(equippedResult[0].accessory_id)
      : null,
  };

  // 组装完整的 Cultivator 对象
  const cultivator: Cultivator = {
    id: cultivatorRecord.id,
    name: cultivatorRecord.name,
    title: cultivatorRecord.title || undefined,
    gender: (cultivatorRecord.gender as Cultivator['gender']) || undefined,
    origin: cultivatorRecord.origin || undefined,
    personality: cultivatorRecord.personality || undefined,
    background: cultivatorRecord.background || undefined,
    prompt: cultivatorRecord.prompt,
    realm: cultivatorRecord.realm as Cultivator['realm'],
    realm_stage: cultivatorRecord.realm_stage as Cultivator['realm_stage'],
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
    // 修为系统：如果数据库有值则使用，否则初始化
    cultivation_progress: getOrInitCultivationProgress(
      cultivatorRecord.cultivation_progress as CultivationProgress,
      cultivatorRecord.realm as Cultivator['realm'],
      cultivatorRecord.realm_stage as Cultivator['realm_stage'],
    ),
  };

  return cultivator;
}

/**
 * 创建角色（从临时表保存到正式表）
 */
export async function createCultivator(
  userId: string,
  cultivator: Cultivator,
): Promise<Cultivator> {
  const result = await db.transaction(async (tx) => {
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
      await tx.insert(schema.spiritualRoots).values(
        cultivator.spiritual_roots.map((root) => ({
          cultivatorId,
          element: root.element,
          strength: root.strength,
          grade: root.grade || null,
        })),
      );
    }

    // 3. 创建先天命格
    if (cultivator.pre_heaven_fates.length > 0) {
      await tx.insert(schema.preHeavenFates).values(
        cultivator.pre_heaven_fates.map((fate) => ({
          cultivatorId,
          name: fate.name,
          type: fate.type,
          quality: fate.quality || null,
          attribute_mod: fate.attribute_mod,
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
          bonus: cult.bonus,
          required_realm: cult.required_realm,
        })),
      );
    }

    // 5. 创建技能
    if (cultivator.skills.length > 0) {
      await tx.insert(schema.skills).values(
        cultivator.skills.map((skill) => ({
          cultivatorId,
          name: skill.name,
          type: skill.type,
          element: skill.element,
          grade: skill.grade || null,
          power: skill.power,
          cost: skill.cost || 0,
          cooldown: skill.cooldown,
          effect: skill.effect || null,
          duration: skill.duration || null,
          target_self: skill.target_self ? 1 : 0,
          description: skill.description || null,
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
  const fullCultivator = await assembleCultivator(result, userId);
  if (!fullCultivator) {
    throw new Error('创建角色后无法组装完整数据');
  }
  return fullCultivator;
}

export async function getUserAliveCultivatorId(
  userId: string,
): Promise<string | null> {
  const record = await db
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
  const cultivatorRecord = await db
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

  return assembleCultivator(cultivatorRecord[0], userId);
}

/**
 * 获取用户的所有角色
 */
export async function getCultivatorsByUserId(
  userId: string,
): Promise<Cultivator[]> {
  const cultivatorRecords = await db
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    );

  const cultivators = await Promise.all(
    cultivatorRecords.map((record) => assembleCultivator(record, userId)),
  );

  return cultivators.filter((c): c is Cultivator => c !== null);
}

export async function hasDeadCultivator(userId: string): Promise<boolean> {
  const rows = await db
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
  const record = await db
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
  const record = await db
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

  const full = await assembleCultivator(record[0], record[0].userId);
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

  const records = await db
    .select()
    .from(schema.cultivators)
    .where(
      and(
        inArray(schema.cultivators.id, cultivatorIds),
        eq(schema.cultivators.status, 'active'),
      ),
    );

  const assembled = await Promise.all(
    records.map(async (record): Promise<CultivatorWithOwner | null> => {
      const full = await assembleCultivator(record, record.userId);
      if (!full) return null;
      return {
        cultivator: full,
        userId: record.userId,
        updatedAt: record.updatedAt,
      };
    }),
  );

  return assembled.filter((item): item is CultivatorWithOwner => item !== null);
}

export async function getCultivatorBasicsByIdUnsafe(
  cultivatorId: string,
): Promise<CultivatorBasic | null> {
  const record = await db
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

  const rows = await db
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
  const rows = await db
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
  const history = await db
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
  const existing = await db
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

  await db
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
  const existing = await db
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
  await db.insert(schema.retreatRecords).values({
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
  await db.insert(schema.breakthroughHistory).values({
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
  const existing = await db
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
  await db
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
  const result = await db
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));

  return result.map((c) => ({
    id: c.id,
    name: c.name,
    quality: c.quality as Quality,
    type: c.type as ConsumableType,
    effect: c.effect as ConsumableEffect[],
    quantity: c.quantity,
    description: c.description || '',
  }));
}

export async function getCultivatorMaterials(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator['inventory']['materials']> {
  const result = await db
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
  const result = await db
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
  const result = await db
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
): Promise<Cultivator['inventory']['artifacts']> {
  const result = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.cultivatorId, cultivatorId));

  return result.map((a) => ({
    id: a.id,
    name: a.name,
    slot: a.slot as Cultivator['inventory']['artifacts'][0]['slot'],
    element: a.element as Cultivator['inventory']['artifacts'][0]['element'],
    bonus: a.bonus as Cultivator['inventory']['artifacts'][0]['bonus'],
    quality: a.quality as
      | Cultivator['inventory']['artifacts'][0]['quality']
      | undefined,
    required_realm: a.required_realm as
      | Cultivator['inventory']['artifacts'][0]['required_realm']
      | undefined,
    special_effects: (a.special_effects ||
      []) as Cultivator['inventory']['artifacts'][0]['special_effects'],
    curses: (a.curses ||
      []) as Cultivator['inventory']['artifacts'][0]['curses'],
    description: a.description || '',
  }));
}

// ===== 临时角色相关操作 =====

/**
 * 创建临时角色
 */
export async function createTempCultivator(
  userId: string,
  cultivator: Cultivator,
  availableFates?: Cultivator['pre_heaven_fates'],
): Promise<string> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

  const result = await db
    .insert(schema.tempCultivators)
    .values({
      userId,
      cultivatorData: cultivator,
      availableFates: availableFates || null,
      expiresAt,
    })
    .returning();

  return result[0].id;
}

/**
 * 获取临时角色
 */
export async function getTempCultivator(
  userId: string,
  tempCultivatorId: string,
): Promise<{
  cultivator: Cultivator;
  availableFates: Cultivator['pre_heaven_fates'] | null;
} | null> {
  const result = await db
    .select()
    .from(schema.tempCultivators)
    .where(
      and(
        eq(schema.tempCultivators.id, tempCultivatorId),
        eq(schema.tempCultivators.userId, userId),
        gt(schema.tempCultivators.expiresAt, new Date()), // 确保未过期
      ),
    );

  if (result.length === 0) {
    return null;
  }

  return {
    cultivator: result[0].cultivatorData as Cultivator,
    availableFates:
      (result[0].availableFates as Cultivator['pre_heaven_fates']) || null,
  };
}

/**
 * 将临时角色保存到正式表
 */
export async function saveTempCultivatorToFormal(
  userId: string,
  tempCultivatorId: string,
  selectedFateIndices?: number[],
): Promise<Cultivator> {
  const tempData = await getTempCultivator(userId, tempCultivatorId);
  if (!tempData) {
    throw new Error('临时角色不存在或已过期');
  }

  const { cultivator, availableFates } = tempData;

  // 如果提供了选中的气运索引，从可用气运中选择
  if (selectedFateIndices && availableFates && availableFates.length > 0) {
    const selectedFates = selectedFateIndices
      .filter((idx) => idx >= 0 && idx < availableFates.length)
      .map((idx) => availableFates[idx])
      .slice(0, 3); // 最多选择3个

    cultivator.pre_heaven_fates = selectedFates;
  }

  // 创建正式角色
  const formalCultivator = await createCultivator(userId, cultivator);

  // 删除临时角色
  await deleteTempCultivator(userId, tempCultivatorId);

  return formalCultivator;
}

/**
 * 删除临时角色
 */
export async function deleteTempCultivator(
  userId: string,
  tempCultivatorId: string,
): Promise<boolean> {
  const result = await db
    .delete(schema.tempCultivators)
    .where(
      and(
        eq(schema.tempCultivators.id, tempCultivatorId),
        eq(schema.tempCultivators.userId, userId),
      ),
    )
    .returning();

  return result.length > 0;
}

/**
 * 清理过期的临时角色
 */
export async function cleanupExpiredTempCultivators(): Promise<void> {
  await db
    .delete(schema.tempCultivators)
    .where(lt(schema.tempCultivators.expiresAt, new Date()));
}

// ===== 物品栏和装备相关操作 =====

/**
 * 获取角色物品栏
 */
export async function getInventory(
  userId: string,
  cultivatorId: string,
): Promise<import('../../types/cultivator').Inventory> {
  // 权限验证
  const existing = await db
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

  // 获取法宝、消耗品和材料
  const [artifactsResult, consumablesResult, materialsResult] =
    await Promise.all([
      db
        .select()
        .from(schema.artifacts)
        .where(eq(schema.artifacts.cultivatorId, cultivatorId)),
      db
        .select()
        .from(schema.consumables)
        .where(eq(schema.consumables.cultivatorId, cultivatorId)),
      db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.cultivatorId, cultivatorId)),
    ]);

  return {
    artifacts: artifactsResult.map((a) => ({
      id: a.id,
      name: a.name,
      slot: a.slot as EquipmentSlot,
      element: a.element as ElementType,
      bonus: a.bonus as import('../../types/cultivator').ArtifactBonus,
      special_effects: (a.special_effects ||
        []) as import('../../types/cultivator').ArtifactEffect[],
      curses: (a.curses ||
        []) as import('../../types/cultivator').ArtifactEffect[],
    })),
    consumables: consumablesResult.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as ConsumableType,
      quality: c.quality as Quality | undefined,
      effect: (Array.isArray(c.effect)
        ? c.effect
        : [c.effect].filter(Boolean)) as
        | import('../../types/cultivator').ConsumableEffect[]
        | undefined,
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
  const existing = await db
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
  const artifact = await db
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
  const equippedItems = await db
    .select()
    .from(schema.equippedItems)
    .where(eq(schema.equippedItems.cultivatorId, cultivatorId));

  let equippedItem;
  if (equippedItems.length === 0) {
    // 如果没有装备状态记录，创建一个
    const newEquipped = await db
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
  const updated = await db
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
  const existing = await db
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
  const skillsResult = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.cultivatorId, cultivatorId));

  return skillsResult.map((skill) => ({
    id: skill.id,
    name: skill.name,
    type: skill.type as SkillType,
    element: skill.element as ElementType,
    grade: skill.grade as SkillGrade | undefined,
    power: skill.power,
    cost: skill.cost || undefined,
    cooldown: skill.cooldown,
    effect: skill.effect as StatusEffect | undefined,
    duration: skill.duration || undefined,
    target_self: skill.target_self === 1 ? true : undefined,
    description: skill.description || undefined,
  }));
}

// ===== 装备相关操作 =====

/**
 * 服用丹药
 */
export async function consumeItem(
  userId: string,
  cultivatorId: string,
  consumableId: string,
): Promise<{ success: boolean; message: string; cultivator: Cultivator }> {
  // 1. 验证归属
  await assertCultivatorOwnership(userId, cultivatorId);

  // 2. 查找丹药
  const consumableRows = await db
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.id, consumableId));

  if (consumableRows.length === 0) {
    throw new Error('丹药不存在或已消耗');
  }
  const item = consumableRows[0];
  if (item.cultivatorId !== cultivatorId) {
    throw new Error('丹药不属于该道友');
  }

  const cultivator = await getCultivatorById(userId, cultivatorId);
  if (!cultivator) throw new Error('道友状态异常');

  // 3. 应用效果
  const effects = (item.effect as ConsumableEffect[]) || [];

  if (effects.length === 0) {
    // 即使无效也消耗掉
    await handleConsumeItem(item.id, item.quantity);
    return {
      success: false,
      message: '此丹药灵气尽失，服用后毫无反应。',
      cultivator: (await getCultivatorById(userId, cultivatorId))!,
    };
  }

  const newStats = { ...cultivator.attributes };
  let message = `服用了【${item.name}】，`;
  const changes: string[] = [];

  // 获取当前境界属性上限
  const attrCap = getRealmStageAttributeCap(
    cultivator.realm,
    cultivator.realm_stage,
  );

  let isFullyCapped = true;

  // 预检：检查是否所有属性都已达到上限
  for (const effect of effects) {
    const bonus = effect.bonus || 0;
    if (bonus > 0) {
      if (effect.effect_type === '永久提升体魄' && newStats.vitality < attrCap)
        isFullyCapped = false;
      if (effect.effect_type === '永久提升灵力' && newStats.spirit < attrCap)
        isFullyCapped = false;
      if (effect.effect_type === '永久提升悟性' && newStats.wisdom < attrCap)
        isFullyCapped = false;
      if (effect.effect_type === '永久提升身法' && newStats.speed < attrCap)
        isFullyCapped = false;
      if (effect.effect_type === '永久提升神识' && newStats.willpower < attrCap)
        isFullyCapped = false;
    }
  }

  if (isFullyCapped && effects.some((e) => e.bonus > 0)) {
    return {
      success: false,
      message: '道友当前境界已臻圆满，无法再吸收药力。请先尝试突破瓶颈。',
      cultivator,
    };
  }

  for (const effect of effects) {
    const bonus = effect.bonus || 0;
    if (bonus > 0) {
      let realGain = 0;
      let targetAttr = '';

      if (effect.effect_type === '永久提升体魄') {
        targetAttr = '体魄';
        realGain = Math.min(bonus, Math.max(0, attrCap - newStats.vitality));
        newStats.vitality += realGain;
      } else if (effect.effect_type === '永久提升灵力') {
        targetAttr = '灵力';
        realGain = Math.min(bonus, Math.max(0, attrCap - newStats.spirit));
        newStats.spirit += realGain;
      } else if (effect.effect_type === '永久提升悟性') {
        targetAttr = '悟性';
        realGain = Math.min(bonus, Math.max(0, attrCap - newStats.wisdom));
        newStats.wisdom += realGain;
      } else if (effect.effect_type === '永久提升身法') {
        targetAttr = '身法';
        realGain = Math.min(bonus, Math.max(0, attrCap - newStats.speed));
        newStats.speed += realGain;
      } else if (effect.effect_type === '永久提升神识') {
        targetAttr = '神识';
        realGain = Math.min(bonus, Math.max(0, attrCap - newStats.willpower));
        newStats.willpower += realGain;
      }

      if (realGain > 0) {
        changes.push(`${targetAttr}+${realGain}`);
      } else if (bonus > 0) {
        // 尝试提升但被阻断
        changes.push(`${targetAttr}已至上限`);
      }
    }
  }

  if (changes.length === 0) {
    message += '感觉身体热了一下，除此之外并无变化。';
  } else {
    message += '顿感灵台清明，' + changes.join('，') + '。';
  }

  // 4. 执行事务：消耗丹药 + 更新属性
  await db.transaction(async (tx) => {
    // 消耗丹药
    if (item.quantity > 1) {
      await tx
        .update(schema.consumables)
        .set({ quantity: item.quantity - 1 })
        .where(eq(schema.consumables.id, consumableId));
    } else {
      await tx
        .delete(schema.consumables)
        .where(eq(schema.consumables.id, consumableId));
    }

    // 更新角色属性
    await tx
      .update(schema.cultivators)
      .set({
        vitality: newStats.vitality,
        spirit: newStats.spirit,
        wisdom: newStats.wisdom,
        speed: newStats.speed,
        willpower: newStats.willpower,
      })
      .where(eq(schema.cultivators.id, cultivatorId));
  });

  const updatedCultivator = await getCultivatorById(userId, cultivatorId);
  if (!updatedCultivator) throw new Error('更新后无法获取数据');

  return { success: true, message, cultivator: updatedCultivator };
}

async function handleConsumeItem(itemId: string, currentQuantity: number) {
  if (currentQuantity > 1) {
    await db
      .update(schema.consumables)
      .set({ quantity: currentQuantity - 1 })
      .where(eq(schema.consumables.id, itemId));
  } else {
    await db
      .delete(schema.consumables)
      .where(eq(schema.consumables.id, itemId));
  }
}
