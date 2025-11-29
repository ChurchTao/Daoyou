import { and, eq } from 'drizzle-orm';
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
          ? JSON.parse(skill.effects as string)
          : undefined,
      })),
      equipment: equipmentResult.map((equipment) => ({
        name: equipment.name,
        bonus: equipment.bonus
          ? JSON.parse(equipment.bonus as string)
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
                ? JSON.parse(skill.effects as string)
                : undefined,
            })),
            equipment: equipmentResult.map((equipment) => ({
              name: equipment.name,
              bonus: equipment.bonus
                ? JSON.parse(equipment.bonus as string)
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
      effects: skill.effects ? JSON.parse(skill.effects as string) : undefined,
    })),
    equipment: equipmentResult.map((equipment) => ({
      name: equipment.name,
      bonus: equipment.bonus
        ? JSON.parse(equipment.bonus as string)
        : undefined,
    })),
    element: battleProfileData.element as any,
  };
}
