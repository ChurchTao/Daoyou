import { and, eq, gt, lt } from 'drizzle-orm';
import type { Cultivator } from '../../types/cultivator';
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

  // 并行获取所有关联数据
  const [
    spiritualRootsResult,
    preHeavenFatesResult,
    cultivationsResult,
    skillsResult,
    artifactsResult,
    consumablesResult,
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
      .from(schema.artifacts)
      .where(eq(schema.artifacts.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.consumables)
      .where(eq(schema.consumables.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.equippedItems)
      .where(eq(schema.equippedItems.cultivatorId, cultivatorId)),
  ]);

  // 组装灵根
  const spiritual_roots = spiritualRootsResult.map((r) => ({
    element: r.element as Cultivator['spiritual_roots'][0]['element'],
    strength: r.strength,
  }));

  // 组装先天命格
  const pre_heaven_fates = preHeavenFatesResult.map((f) => ({
    name: f.name,
    type: f.type as '吉' | '凶',
    attribute_mod: f.attribute_mod as Cultivator['pre_heaven_fates'][0]['attribute_mod'],
    description: f.description || undefined,
  }));

  // 组装功法
  const cultivations = cultivationsResult.map((c) => ({
    name: c.name,
    bonus: c.bonus as Cultivator['cultivations'][0]['bonus'],
    required_realm: c.required_realm as Cultivator['cultivations'][0]['required_realm'],
  }));

  // 组装技能（使用数据库 UUID 作为 id）
  const skills = skillsResult.map((s) => ({
    id: s.id, // 使用数据库生成的 UUID
    name: s.name,
    type: s.type as Cultivator['skills'][0]['type'],
    element: s.element as Cultivator['skills'][0]['element'],
    power: s.power,
    cost: s.cost || undefined,
    cooldown: s.cooldown,
    effect: s.effect as Cultivator['skills'][0]['effect'] | undefined,
    duration: s.duration || undefined,
    target_self: s.target_self === 1 ? true : undefined,
  }));

  // 组装法宝
  const artifacts = artifactsResult.map((a) => ({
    id: a.id,
    name: a.name,
    slot: a.slot as Cultivator['inventory']['artifacts'][0]['slot'],
    element: a.element as Cultivator['inventory']['artifacts'][0]['element'],
    bonus: a.bonus as Cultivator['inventory']['artifacts'][0]['bonus'],
    special_effects: (a.special_effects || []) as Cultivator['inventory']['artifacts'][0]['special_effects'],
    curses: (a.curses || []) as Cultivator['inventory']['artifacts'][0]['curses'],
  }));

  // 组装消耗品
  const consumables = consumablesResult.map((c) => ({
    name: c.name,
    type: c.type as Cultivator['inventory']['consumables'][0]['type'],
    effect: c.effect as Cultivator['inventory']['consumables'][0]['effect'] | undefined,
  }));

  // 组装装备状态（将 UUID 转换为字符串）
  const equipped: Cultivator['equipped'] = {
    weapon: equippedResult[0]?.weapon_id ? String(equippedResult[0].weapon_id) : null,
    armor: equippedResult[0]?.armor_id ? String(equippedResult[0].armor_id) : null,
    accessory: equippedResult[0]?.accessory_id ? String(equippedResult[0].accessory_id) : null,
  };

  // 组装完整的 Cultivator 对象
  const cultivator: Cultivator = {
    id: cultivatorRecord.id,
    name: cultivatorRecord.name,
    gender: (cultivatorRecord.gender as Cultivator['gender']) || undefined,
    origin: cultivatorRecord.origin || undefined,
    personality: cultivatorRecord.personality || undefined,
    background: cultivatorRecord.background || undefined,
    prompt: cultivatorRecord.prompt,
    realm: cultivatorRecord.realm as Cultivator['realm'],
    realm_stage: cultivatorRecord.realm_stage as Cultivator['realm_stage'],
    age: cultivatorRecord.age,
    lifespan: cultivatorRecord.lifespan,
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
    },
    equipped,
    max_skills: cultivatorRecord.max_skills,
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
          power: skill.power,
          cost: skill.cost || 0,
          cooldown: skill.cooldown,
          effect: skill.effect || null,
          duration: skill.duration || null,
          target_self: skill.target_self ? 1 : 0,
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
    .where(eq(schema.cultivators.userId, userId));

  const cultivators = await Promise.all(
    cultivatorRecords.map((record) => assembleCultivator(record, userId)),
  );

  return cultivators.filter((c): c is Cultivator => c !== null);
}

/**
 * 更新角色基本信息
 */
export async function updateCultivator(
  userId: string,
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
    >
  >,
): Promise<Cultivator | null> {
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
    updateData.vitality = updates.attributes.vitality;
    updateData.spirit = updates.attributes.spirit;
    updateData.wisdom = updates.attributes.wisdom;
    updateData.speed = updates.attributes.speed;
    updateData.willpower = updates.attributes.willpower;
  }
  if (updates.max_skills !== undefined)
    updateData.max_skills = updates.max_skills;

  await db
    .update(schema.cultivators)
    .set(updateData)
    .where(eq(schema.cultivators.id, cultivatorId));

  return getCultivatorById(userId, cultivatorId);
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

// ===== 临时角色相关操作 =====

/**
 * 创建临时角色
 */
export async function createTempCultivator(
  userId: string,
  cultivator: Cultivator,
): Promise<string> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

  const result = await db
    .insert(schema.tempCultivators)
    .values({
      userId,
      cultivatorData: cultivator,
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
): Promise<Cultivator | null> {
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

  return result[0].cultivatorData as Cultivator;
}

/**
 * 将临时角色保存到正式表
 */
export async function saveTempCultivatorToFormal(
  userId: string,
  tempCultivatorId: string,
): Promise<Cultivator> {
  const tempCultivator = await getTempCultivator(userId, tempCultivatorId);
  if (!tempCultivator) {
    throw new Error('临时角色不存在或已过期');
  }

  // 创建正式角色
  const formalCultivator = await createCultivator(userId, tempCultivator);

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

  // 获取法宝和消耗品
  const [artifactsResult, consumablesResult] = await Promise.all([
    db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.cultivatorId, cultivatorId)),
    db
      .select()
      .from(schema.consumables)
      .where(eq(schema.consumables.cultivatorId, cultivatorId)),
  ]);

  return {
    artifacts: artifactsResult.map((a) => ({
      id: a.id,
      name: a.name,
      slot: a.slot as import('../../types/cultivator').EquipmentSlot,
      element: a.element as import('../../types/cultivator').ElementType,
      bonus: a.bonus as import('../../types/cultivator').ArtifactBonus,
      special_effects: (a.special_effects || []) as import('../../types/cultivator').ArtifactEffect[],
      curses: (a.curses || []) as import('../../types/cultivator').ArtifactEffect[],
    })),
    consumables: consumablesResult.map((c) => ({
      name: c.name,
      type: c.type as import('../../types/cultivator').ConsumableType,
      effect: c.effect as import('../../types/cultivator').ConsumableEffect | undefined,
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
 * 创建技能
 */
export async function createSkill(
  userId: string,
  cultivatorId: string,
  skillData: Omit<import('../../types/cultivator').Skill, 'id'>,
): Promise<import('../../types/cultivator').Skill> {
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

  // 创建技能
  const skill = await db.insert(schema.skills).values({
    cultivatorId,
    name: skillData.name,
    type: skillData.type,
    element: skillData.element,
    power: skillData.power,
    cost: skillData.cost || 0,
    cooldown: skillData.cooldown,
    effect: skillData.effect || null,
    duration: skillData.duration || null,
    target_self: skillData.target_self ? 1 : 0,
  }).returning();

  const skillRecord = skill[0];

  return {
    id: skillRecord.id, 
    ...skillData,
  };
}

/**
 * 替换技能
 */
export async function replaceSkill(
  userId: string,
  cultivatorId: string,
  oldSkillId: string,
  newSkillData: Omit<import('../../types/cultivator').Skill, 'id'>,
): Promise<import('../../types/cultivator').Skill> {
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

  // 更新技能
  await db
    .update(schema.skills)
    .set({
      name: newSkillData.name,
      type: newSkillData.type,
      element: newSkillData.element,
      power: newSkillData.power,
      cost: newSkillData.cost || 0,
      cooldown: newSkillData.cooldown,
      effect: newSkillData.effect || null,
      duration: newSkillData.duration || null,
      target_self: newSkillData.target_self ? 1 : 0,
    })
    .where(
      and(
        eq(schema.skills.cultivatorId, cultivatorId),
        eq(schema.skills.id, oldSkillId),
      ),
    );

  return {
    id: oldSkillId,
    ...newSkillData,
  };
}

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
    type: skill.type as import('../../types/cultivator').Skill['type'],
    element: skill.element as import('../../types/cultivator').Skill['element'],
    power: skill.power,
    cost: skill.cost || undefined,
    cooldown: skill.cooldown,
    effect: skill.effect as import('../../types/cultivator').Skill['effect'] | undefined,
    duration: skill.duration || undefined,
    target_self: skill.target_self === 1 ? true : undefined,
  }));
}

// ===== 装备相关操作 =====

/**
 * 创建装备（法宝）
 */
export async function createEquipment(
  userId: string,
  cultivatorId: string,
  equipmentData: Omit<import('../../types/cultivator').Artifact, 'id'>,
): Promise<import('../../types/cultivator').Artifact> {
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

  // 创建装备（使用数据库生成的 UUID 作为 id）
  const artifactResult = await db.insert(schema.artifacts).values({
    cultivatorId,
    name: equipmentData.name,
    slot: equipmentData.slot,
    element: equipmentData.element,
    bonus: equipmentData.bonus,
    special_effects: equipmentData.special_effects || [],
    curses: equipmentData.curses || [],
  }).returning();

  const artifactRecord = artifactResult[0];

  return {
    id: artifactRecord.id, // 使用数据库生成的 UUID
    ...equipmentData,
  };
}
