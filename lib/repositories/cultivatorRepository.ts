import { and, eq, gt, lt } from 'drizzle-orm';
import type { BattleProfile, Cultivator } from '../../types/cultivator';
import { db } from '../drizzle/db';
import * as schema from '../drizzle/schema';

export async function createCultivator(
  userId: string,
  cultivatorData: Omit<Cultivator, 'id' | 'battleProfile'>,
  battleProfile: BattleProfile,
): Promise<Cultivator> {
  // 开始事务，确保原子性操作
  const result = await db.transaction(async (tx) => {
    // 1. 创建角色基本信息
    const cultivatorResult = await tx
      .insert(schema.cultivators)
      .values({
        userId,
        name: cultivatorData.name,
        prompt: cultivatorData.prompt,
        cultivationLevel: cultivatorData.cultivationLevel,
        spiritRoot: cultivatorData.spiritRoot,
        appearance: cultivatorData.appearance,
        backstory: cultivatorData.backstory,
        gender: cultivatorData.gender,
        origin: cultivatorData.origin,
        personality: cultivatorData.personality,
      })
      .returning();

    const cultivator = cultivatorResult[0];

    // 2. 创建战斗属性
    const battleProfileResult = await tx
      .insert(schema.battleProfiles)
      .values({
        cultivatorId: cultivator.id,
        maxHp: battleProfile.maxHp,
        hp: battleProfile.hp,
        vitality: battleProfile.attributes.vitality,
        spirit: battleProfile.attributes.spirit,
        wisdom: battleProfile.attributes.wisdom,
        speed: battleProfile.attributes.speed,
        element: battleProfile.element,
      })
      .returning();

    // 3. 创建技能（如果有）
    if (battleProfile.skills && battleProfile.skills.length > 0) {
      await tx.insert(schema.skills).values(
        battleProfile.skills.map((skill) => ({
          cultivatorId: cultivator.id,
          name: skill.name,
          type: skill.type,
          power: skill.power,
          element: skill.element,
          effects: skill.effects ? JSON.stringify(skill.effects) : undefined,
        })),
      );
    }

    // 4. 创建装备（如果有）
    if (battleProfile.equipment && battleProfile.equipment.length > 0) {
      await tx.insert(schema.equipment).values(
        battleProfile.equipment.map((equipment) => ({
          cultivatorId: cultivator.id,
          name: equipment.name,
          bonus: equipment.bonus ? JSON.stringify(equipment.bonus) : undefined,
        })),
      );
    }

    // 5. 创建先天命格（如果有）
    if (
      cultivatorData.preHeavenFates &&
      cultivatorData.preHeavenFates.length > 0
    ) {
      await tx.insert(schema.preHeavenFates).values(
        cultivatorData.preHeavenFates.map((fate) => ({
          cultivatorId: cultivator.id,
          name: fate.name,
          type: fate.type,
          effect: fate.effect,
          description: fate.description,
        })),
      );
    }

    return cultivator;
  });

  // 构建完整的Cultivator对象返回
  return {
    id: result.id,
    ...cultivatorData,
    battleProfile,
  };
}

export async function getCultivatorById(
  userId: string,
  cultivatorId: string,
): Promise<Cultivator | null> {
  // 使用join查询获取角色基本信息和战斗属性
  const cultivatorWithBattleProfile = await db
    .select({
      cultivator: schema.cultivators,
      battleProfile: schema.battleProfiles,
    })
    .from(schema.cultivators)
    .innerJoin(
      schema.battleProfiles,
      eq(schema.battleProfiles.cultivatorId, schema.cultivators.id),
    )
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (cultivatorWithBattleProfile.length === 0) {
    return null;
  }

  const { cultivator, battleProfile: battleProfileData } =
    cultivatorWithBattleProfile[0];

  // 并行获取技能、装备和先天命格
  const [skillsResult, equipmentResult, preHeavenFatesResult] =
    await Promise.all([
      db
        .select()
        .from(schema.skills)
        .where(eq(schema.skills.cultivatorId, cultivatorId)),
      db
        .select()
        .from(schema.equipment)
        .where(eq(schema.equipment.cultivatorId, cultivatorId)),
      db
        .select()
        .from(schema.preHeavenFates)
        .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId)),
    ]);

  // 构建完整的Cultivator对象
  const fullCultivator: Cultivator = {
    id: cultivator.id,
    name: cultivator.name,
    prompt: cultivator.prompt,
    cultivationLevel: cultivator.cultivationLevel,
    spiritRoot: cultivator.spiritRoot,
    appearance: cultivator.appearance || '',
    backstory: cultivator.backstory || '',
    gender: cultivator.gender || undefined,
    origin: cultivator.origin || undefined,
    personality: cultivator.personality || undefined,
    maxEquipments: cultivator.maxEquipments || 3,
    maxSkills: cultivator.maxSkills || 4,
    preHeavenFates: preHeavenFatesResult.map((fate) => ({
      name: fate.name,
      type: fate.type as '吉' | '凶',
      effect: fate.effect,
      description: fate.description,
    })),
    battleProfile: {
      maxHp: battleProfileData.maxHp,
      hp: battleProfileData.hp,
      attributes: {
        vitality: battleProfileData.vitality,
        spirit: battleProfileData.spirit,
        wisdom: battleProfileData.wisdom,
        speed: battleProfileData.speed,
      },
      skills: skillsResult.map((skill) => ({
        name: skill.name,
        type: skill.type as 'attack' | 'heal' | 'control' | 'buff',
        power: skill.power,
        element: skill.element as any,
        effects: skill.effects
          ? typeof skill.effects === 'string' && skill.effects.trim() !== ''
            ? JSON.parse(skill.effects)
            : skill.effects
          : undefined,
      })),
      equipment: equipmentResult.map((equipment) => ({
        name: equipment.name,
        type: equipment.type as any,
        element: equipment.element as any,
        bonus: equipment.bonus
          ? typeof equipment.bonus === 'string' && equipment.bonus.trim() !== ''
            ? JSON.parse(equipment.bonus)
            : equipment.bonus
          : undefined,
      })),
      element: battleProfileData.element as any,
    },
  };

  return fullCultivator;
}

export async function getCultivatorsByUserId(
  userId: string,
): Promise<Cultivator[]> {
  // 获取用户的所有角色基本信息和战斗属性
  const cultivatorsWithBattleProfiles = await db
    .select({
      cultivator: schema.cultivators,
      battleProfile: schema.battleProfiles,
    })
    .from(schema.cultivators)
    .innerJoin(
      schema.battleProfiles,
      eq(schema.battleProfiles.cultivatorId, schema.cultivators.id),
    )
    .where(eq(schema.cultivators.userId, userId));

  // 并行获取每个角色的完整信息
  const fullCultivators = await Promise.all(
    cultivatorsWithBattleProfiles.map(
      async ({ cultivator, battleProfile: battleProfileData }) => {
        // 并行获取技能、装备和先天命格
        const [skillsResult, equipmentResult, preHeavenFatesResult] =
          await Promise.all([
            db
              .select()
              .from(schema.skills)
              .where(eq(schema.skills.cultivatorId, cultivator.id)),
            db
              .select()
              .from(schema.equipment)
              .where(eq(schema.equipment.cultivatorId, cultivator.id)),
            db
              .select()
              .from(schema.preHeavenFates)
              .where(eq(schema.preHeavenFates.cultivatorId, cultivator.id)),
          ]);

        return {
          id: cultivator.id,
          name: cultivator.name,
          prompt: cultivator.prompt,
          cultivationLevel: cultivator.cultivationLevel,
          spiritRoot: cultivator.spiritRoot,
          appearance: cultivator.appearance || '',
          backstory: cultivator.backstory || '',
          gender: cultivator.gender || undefined,
          origin: cultivator.origin || undefined,
          personality: cultivator.personality || undefined,
          maxEquipments: cultivator.maxEquipments || 3,
          maxSkills: cultivator.maxSkills || 4,
          preHeavenFates: preHeavenFatesResult.map((fate) => ({
            name: fate.name,
            type: fate.type as '吉' | '凶',
            effect: fate.effect,
            description: fate.description,
          })),
          battleProfile: {
            maxHp: battleProfileData.maxHp,
            hp: battleProfileData.hp,
            attributes: {
              vitality: battleProfileData.vitality,
              spirit: battleProfileData.spirit,
              wisdom: battleProfileData.wisdom,
              speed: battleProfileData.speed,
            },
            skills: skillsResult.map((skill) => ({
              name: skill.name,
              type: skill.type as 'attack' | 'heal' | 'control' | 'buff',
              power: skill.power,
              element: skill.element as any,
              effects: skill.effects
                ? typeof skill.effects === 'string' && skill.effects.trim() !== ''
                  ? JSON.parse(skill.effects)
                  : skill.effects
                : undefined,
            })),
            equipment: equipmentResult.map((equipment) => ({
              name: equipment.name,
              type: equipment.type as any,
              element: equipment.element as any,
              bonus: equipment.bonus
                ? typeof equipment.bonus === 'string' && equipment.bonus.trim() !== ''
                  ? JSON.parse(equipment.bonus)
                  : equipment.bonus
                : undefined,
            })),
            element: battleProfileData.element as any,
          },
        } as Cultivator;
      },
    ),
  );

  return fullCultivators;
}

export async function updateCultivator(
  userId: string,
  cultivatorId: string,
  updates: Partial<Omit<Cultivator, 'id' | 'battleProfile'>>,
): Promise<Cultivator | null> {
  // 权限验证：确保只有角色所有者可以更新角色
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    return null;
  }

  // 更新角色基本信息
  await db
    .update(schema.cultivators)
    .set(updates)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  // 返回更新后的完整角色信息
  return getCultivatorById(userId, cultivatorId);
}

export async function deleteCultivator(
  userId: string,
  cultivatorId: string,
): Promise<boolean> {
  // 权限验证：确保只有角色所有者可以删除角色
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    return false;
  }

  // 开始事务，确保原子性操作
  await db.transaction(async (tx) => {
    // 删除技能
    await tx
      .delete(schema.skills)
      .where(eq(schema.skills.cultivatorId, cultivatorId));

    // 删除装备
    await tx
      .delete(schema.equipment)
      .where(eq(schema.equipment.cultivatorId, cultivatorId));

    // 删除先天命格
    await tx
      .delete(schema.preHeavenFates)
      .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId));

    // 删除战斗属性
    await tx
      .delete(schema.battleProfiles)
      .where(eq(schema.battleProfiles.cultivatorId, cultivatorId));

    // 删除角色
    await tx
      .delete(schema.cultivators)
      .where(
        and(
          eq(schema.cultivators.id, cultivatorId),
          eq(schema.cultivators.userId, userId),
        ),
      );
  });

  return true;
}

export async function updateBattleProfile(
  userId: string,
  cultivatorId: string,
  updates: Partial<BattleProfile>,
): Promise<BattleProfile | null> {
  // 权限验证：确保只有角色所有者可以更新战斗属性
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    return null;
  }

  // 开始事务，确保原子性操作
  await db.transaction(async (tx) => {
    // 更新战斗属性
    const updateData: any = {};

    if (updates.maxHp !== undefined) {
      updateData.maxHp = updates.maxHp;
    }

    if (updates.hp !== undefined) {
      updateData.hp = updates.hp;
    }

    if (updates.attributes) {
      updateData.vitality = updates.attributes.vitality;
      updateData.spirit = updates.attributes.spirit;
      updateData.wisdom = updates.attributes.wisdom;
      updateData.speed = updates.attributes.speed;
    }

    if (updates.element !== undefined) {
      updateData.element = updates.element;
    }

    await tx
      .update(schema.battleProfiles)
      .set(updateData)
      .where(eq(schema.battleProfiles.cultivatorId, cultivatorId));

    // 更新技能（如果提供）
    if (updates.skills) {
      // 删除现有技能
      await tx
        .delete(schema.skills)
        .where(eq(schema.skills.cultivatorId, cultivatorId));

      // 插入新技能
      await tx.insert(schema.skills).values(
        updates.skills.map((skill) => ({
          cultivatorId,
          name: skill.name,
          type: skill.type,
          power: skill.power,
          element: skill.element,
          effects: skill.effects ? JSON.stringify(skill.effects) : undefined,
        })),
      );
    }

    // 更新装备（如果提供）
    if (updates.equipment) {
      // 删除现有装备
      await tx
        .delete(schema.equipment)
        .where(eq(schema.equipment.cultivatorId, cultivatorId));

      // 插入新装备
      await tx.insert(schema.equipment).values(
        updates.equipment.map((equipment) => ({
          cultivatorId,
          name: equipment.name,
          bonus: equipment.bonus ? JSON.stringify(equipment.bonus) : undefined,
        })),
      );
    }
  });

  // 获取更新后的战斗属性
  const updatedBattleProfile = await db
    .select()
    .from(schema.battleProfiles)
    .where(eq(schema.battleProfiles.cultivatorId, cultivatorId));

  if (updatedBattleProfile.length === 0) {
    return null;
  }

  const battleProfileData = updatedBattleProfile[0];

  // 获取技能
  const skillsResult = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.cultivatorId, cultivatorId));

  // 获取装备
  const equipmentResult = await db
    .select()
    .from(schema.equipment)
    .where(eq(schema.equipment.cultivatorId, cultivatorId));

  return {
    maxHp: battleProfileData.maxHp,
    hp: battleProfileData.hp,
    attributes: {
      vitality: battleProfileData.vitality,
      spirit: battleProfileData.spirit,
      wisdom: battleProfileData.wisdom,
      speed: battleProfileData.speed,
    },
    skills: skillsResult.map((skill) => ({
      name: skill.name,
      type: skill.type as 'attack' | 'heal' | 'control' | 'buff',
      power: skill.power,
      element: skill.element as any,
      effects: skill.effects
        ? typeof skill.effects === 'string' && skill.effects.trim() !== ''
          ? JSON.parse(skill.effects)
          : skill.effects
        : undefined,
    })),
    equipment: equipmentResult.map((equipment) => ({
      name: equipment.name,
      type: equipment.type as any,
      element: equipment.element as any,
      bonus: equipment.bonus
        ? typeof equipment.bonus === 'string' && equipment.bonus.trim() !== ''
          ? JSON.parse(equipment.bonus)
          : equipment.bonus
        : undefined,
    })),
    element: battleProfileData.element as any,
  };
}

// 临时角色相关操作

/**
 * 创建临时角色
 */
export async function createTempCultivator(
  userId: string,
  cultivator: Cultivator,
): Promise<string> {
  // 计算过期时间：当前时间 + 24小时
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 插入临时角色数据
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
  // 查询临时角色
    const result = await db
      .select()
      .from(schema.tempCultivators)
      .where(
        and(
          eq(schema.tempCultivators.id, tempCultivatorId),
          eq(schema.tempCultivators.userId, userId),
          gt(schema.tempCultivators.expiresAt, new Date()), // 确保角色未过期
        ),
      );

  if (result.length === 0) {
    return null;
  }

  // 直接返回完整的角色数据
  return result[0].cultivatorData as Cultivator;
}

/**
 * 将临时角色保存到正式表
 */
export async function saveTempCultivatorToFormal(
  userId: string,
  tempCultivatorId: string,
): Promise<Cultivator> {
  // 1. 获取临时角色
  const tempCultivator = await getTempCultivator(userId, tempCultivatorId);
  if (!tempCultivator) {
    throw new Error('临时角色不存在或已过期');
  }

  // 2. 将临时角色转换为正式角色
  const cultivatorData = {
    ...tempCultivator,
    battleProfile: undefined,
  };

  // 3. 创建正式角色
  const formalCultivator = await createCultivator(
    userId,
    cultivatorData as Omit<Cultivator, 'id' | 'battleProfile'>,
    tempCultivator.battleProfile!, // 确保battleProfile存在
  );

  // 4. 删除临时角色
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
  // 删除临时角色
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
 * 创建装备
 */
export async function createEquipment(
  userId: string,
  cultivatorId: string,
  equipmentData: Omit<import('../../types/cultivator').Equipment, 'id'>,
): Promise<import('../../types/cultivator').Equipment> {
  // 权限验证：确保只有角色所有者可以创建装备
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 创建装备
  const result = await db
    .insert(schema.equipment)
    .values({
      cultivatorId,
      name: equipmentData.name,
      type: equipmentData.type,
      element: equipmentData.element,
      bonus: equipmentData.bonus,
      specialEffect: equipmentData.specialEffect,
    })
    .returning();

  return {
    id: result[0].id,
    ...equipmentData,
  };
}

/**
 * 获取角色物品栏
 */
export async function getInventory(
  userId: string,
  cultivatorId: string,
): Promise<import('../../types/cultivator').Inventory> {
  // 权限验证：确保只有角色所有者可以获取物品栏
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 获取装备列表
  const equipmentResult = await db
    .select()
    .from(schema.equipment)
    .where(eq(schema.equipment.cultivatorId, cultivatorId));

  // 获取消耗品列表
  const consumablesResult = await db
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));

  return {
    equipments: equipmentResult.map((eq) => ({
      id: eq.id,
      name: eq.name,
      type: eq.type as any,
      element: eq.element as any,
      bonus: eq.bonus as any,
      specialEffect: eq.specialEffect || undefined,
    })),
    consumables: consumablesResult.map((con) => ({
      id: con.id,
      name: con.name,
      effect: con.effect,
      description: con.description || undefined,
    })),
  };
}

/**
 * 装备/卸下装备
 */
export async function equipEquipment(
  userId: string,
  cultivatorId: string,
  equipmentId: string,
): Promise<import('../../types/cultivator').EquippedItems> {
  // 权限验证：确保只有角色所有者可以装备/卸下装备
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 获取装备信息
  const equipment = await db
    .select()
    .from(schema.equipment)
    .where(
      and(
        eq(schema.equipment.id, equipmentId),
        eq(schema.equipment.cultivatorId, cultivatorId),
      ),
    );

  if (equipment.length === 0) {
    throw new Error('装备不存在或无权限操作');
  }

  const equipmentItem = equipment[0];

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
      })
      .returning();
    equippedItem = newEquipped[0];
  } else {
    equippedItem = equippedItems[0];
  }

  // 装备或卸下装备
  let updateData: any = {};
  let isEquipping = true;

  // 检查是否已经装备了该类型的装备
  if (equipmentItem.type === 'weapon') {
    if (equippedItem.weaponId === equipmentItem.id) {
      // 卸下装备
      updateData.weaponId = null;
      isEquipping = false;
    } else {
      // 装备新武器，替换旧武器
      updateData.weaponId = equipmentItem.id;
    }
  } else if (equipmentItem.type === 'armor') {
    if (equippedItem.armorId === equipmentItem.id) {
      updateData.armorId = null;
      isEquipping = false;
    } else {
      updateData.armorId = equipmentItem.id;
    }
  } else if (equipmentItem.type === 'accessory') {
    if (equippedItem.accessoryId === equipmentItem.id) {
      updateData.accessoryId = null;
      isEquipping = false;
    } else {
      updateData.accessoryId = equipmentItem.id;
    }
  }

  // 更新装备状态
  const updated = await db
    .update(schema.equippedItems)
    .set(updateData)
    .where(eq(schema.equippedItems.id, equippedItem.id))
    .returning();

  // 返回装备状态
  return {
    weapon: updated[0].weaponId || undefined,
    armor: updated[0].armorId || undefined,
    accessory: updated[0].accessoryId || undefined,
  };
}

/**
 * 创建技能
 */
export async function createSkill(
  userId: string,
  cultivatorId: string,
  skillData: Omit<import('../../types/cultivator').Skill, 'id'>,
): Promise<import('../../types/cultivator').Skill> {
  // 权限验证：确保只有角色所有者可以创建技能
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 创建技能
  const result = await db
    .insert(schema.skills)
    .values({
      cultivatorId,
      name: skillData.name,
      type: skillData.type,
      power: skillData.power,
      element: skillData.element,
      effects: skillData.effects,
    })
    .returning();

  return {
    name: result[0].name,
    type: result[0].type as any,
    power: result[0].power,
    element: result[0].element as any,
    effects: result[0].effects as string[] | undefined,
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
  // 权限验证：确保只有角色所有者可以替换技能
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 替换技能
  const result = await db
    .update(schema.skills)
    .set({
      name: newSkillData.name,
      type: newSkillData.type,
      power: newSkillData.power,
      element: newSkillData.element,
      effects: newSkillData.effects,
    })
    .where(
      and(
        eq(schema.skills.id, oldSkillId),
        eq(schema.skills.cultivatorId, cultivatorId),
      ),
    )
    .returning();

  if (result.length === 0) {
    throw new Error('技能不存在或无权限操作');
  }

  return {
    name: result[0].name,
    type: result[0].type as any,
    power: result[0].power,
    element: result[0].element as any,
    effects: result[0].effects as string[] | undefined,
  };
}

/**
 * 获取角色技能
 */
export async function getSkills(
  userId: string,
  cultivatorId: string,
): Promise<import('../../types/cultivator').Skill[]> {
  // 权限验证：确保只有角色所有者可以获取技能
  const existingCultivator = await db
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    );

  if (existingCultivator.length === 0) {
    throw new Error('角色不存在或无权限操作');
  }

  // 获取技能列表
  const skillsResult = await db
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.cultivatorId, cultivatorId));

  return skillsResult.map((skill) => ({
    name: skill.name,
    type: skill.type as any,
    power: skill.power,
    element: skill.element as any,
    effects: skill.effects as string[] | undefined,
  }));
}

/**
 * 清理过期的临时角色
 */
export async function cleanupExpiredTempCultivators(): Promise<void> {
  // 删除所有过期的临时角色
  await db
    .delete(schema.tempCultivators)
    .where(lt(schema.tempCultivators.expiresAt, new Date()));
}
