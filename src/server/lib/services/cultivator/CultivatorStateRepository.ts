import {
hasCultivatorOwnership
} from '@server/lib/repositories/cultivatorRepository';
import {
getOrInitCultivationProgress,
stripExpCapForStorage,
syncBottleneckState,
} from '@server/utils/cultivationUtils';
import type { CultivatorCondition } from '@shared/types/condition';
import {
RealmStage,
RealmType
} from '@shared/types/constants';
import type {
BreakthroughHistoryEntry,
CultivationProgress,
Cultivator,
RetreatRecord
} from '@shared/types/cultivator';
import { and,eq,sql } from 'drizzle-orm';
import {
db,
getExecutor,
type DbExecutor,
type DbTransaction
} from '../../drizzle/db';
import * as schema from '../../drizzle/schema';


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
      | 'unallocated_attribute_points'
      | 'closed_door_years_total'
      | 'status'
      | 'cultivation_progress'
      | 'condition'
    >
  >,
  executor?: DbExecutor | DbTransaction,
): Promise<{ id: string } | null> {
  const q = executor ?? getExecutor();
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
    updateData.strength = Math.round(updates.attributes.strength);
    updateData.spirit = Math.round(updates.attributes.spirit);
    updateData.endurance = Math.round(updates.attributes.endurance);
    updateData.speed = Math.round(updates.attributes.speed);
    updateData.willpower = Math.round(updates.attributes.willpower);
  }
  if (updates.unallocated_attribute_points !== undefined) {
    updateData.unallocatedAttributePoints = Math.max(
      0,
      Math.round(updates.unallocated_attribute_points),
    );
  }
  if (updates.closed_door_years_total !== undefined)
    updateData.closedDoorYearsTotal = updates.closed_door_years_total;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.cultivation_progress !== undefined)
    updateData.cultivation_progress = stripExpCapForStorage(
      updates.cultivation_progress,
    );
  if (updates.condition !== undefined) {
    updateData.condition = (updates.condition as CultivatorCondition) ?? {};
  }
  const [updated] = await q
    .update(schema.cultivators)
    .set(updateData)
    .where(eq(schema.cultivators.id, cultivatorId))
    .returning({ id: schema.cultivators.id });
  return updated ?? null;
}

export async function assertCultivatorOwnership(
  userId: string,
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<void> {
  if (!(await hasCultivatorOwnership(userId, cultivatorId, q))) {
    throw new Error('角色不存在或无权限操作');
  }
}

export async function addRetreatRecord(
  userId: string,
  cultivatorId: string,
  record: RetreatRecord,
  executor?: DbExecutor | DbTransaction,
): Promise<void> {
  const q = executor ?? getExecutor();
  if (!(await hasCultivatorOwnership(userId, cultivatorId, q))) {
    throw new Error('角色不存在或无权限操作');
  }
  await q.insert(schema.retreatRecords).values({
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
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(schema.cultivators)
      .where(
        and(
          eq(schema.cultivators.id, cultivatorId),
          eq(schema.cultivators.userId, userId),
        ),
      )
      .returning({ id: schema.cultivators.id });
    if (!deleted.length) return false;
    // 占卜记录无外键，在角色删除事务内显式清理。
    await tx.delete(schema.dailyDivinations)
      .where(eq(schema.dailyDivinations.cultivatorId, cultivatorId));
    return true;
  });
}

// ===== 单独获取数据的接口 =====


const RESOURCE_SAFETY = {
  spirit_stones: {
    maxDelta: 10_000_000, // 单次最多变动 1000 万灵石
    ceiling: 1_000_000_000, // 灵石绝对上限 10 亿
  },
  reputation: {
    maxDelta: 9999, // 单次最多变动 9999 声望
    ceiling: 1_000_000, // 声望绝对上限 100 万
  },
  lifespan: {
    maxDelta: 100_000, // 单次最多变动 10 万年寿元
    ceiling: 10_000_000, // 寿元绝对上限 1000 万年
  },
  cultivation_exp: {
    maxDelta: 10_000_000, // 单次最多变动 1000 万修为
    ceiling: 1_000_000_000, // 修为绝对上限 10 亿
  },
} as const;

/**
 * 校验并夹紧资源变化量，返回安全的 delta 值
 * 拒绝 NaN/Infinity，并将变化量限制在 maxDelta 范围内
 */
function clampResourceDelta(delta: number, maxDelta: number): number {
  if (!Number.isFinite(delta)) {
    throw new Error(`非法的资源变化量: ${delta}（必须为有限数）`);
  }
  return Math.max(-maxDelta, Math.min(maxDelta, delta));
}

function assertResourceDeltaInRange(delta: number, maxDelta: number): number {
  if (!Number.isFinite(delta)) {
    throw new Error(`非法的资源变化量: ${delta}（必须为有限数）`);
  }
  if (Math.abs(delta) > maxDelta) {
    throw new Error(`资源变化量超出上限: ${delta}（单次最多 ${maxDelta}）`);
  }
  return delta;
}

/**
 * 更新角色灵石数量
 */
export async function updateSpiritStones(
  userId: string,
  cultivatorId: string,
  delta: number,
  tx?: DbTransaction,
): Promise<number> {
  const dbInstance = getExecutor(tx);
  const safeDelta = clampResourceDelta(
    delta,
    RESOURCE_SAFETY.spirit_stones.maxDelta,
  );

  const [updated] = await dbInstance
    .update(schema.cultivators)
    .set({
      spirit_stones: sql`LEAST(
        ${RESOURCE_SAFETY.spirit_stones.ceiling},
        ${schema.cultivators.spirit_stones} + ${safeDelta}
      )`,
    })
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
        sql`${schema.cultivators.spirit_stones} + ${safeDelta} >= 0`,
      ),
    )
    .returning({ value: schema.cultivators.spirit_stones });

  if (updated) return updated.value;

  const [current] = await dbInstance
    .select({
      userId: schema.cultivators.userId,
      value: schema.cultivators.spirit_stones,
    })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);
  if (!current || current.userId !== userId) {
    throw new Error('角色不存在或无权限操作');
  }
  if (safeDelta < 0) {
    throw new Error(`灵石不足，需要 ${-safeDelta}，当前拥有 ${current.value}`);
  }
  throw new Error('灵石更新失败');
}

/**
 * 更新角色声望
 */
export async function updateReputation(
  userId: string,
  cultivatorId: string,
  delta: number,
  tx?: DbTransaction,
): Promise<number> {
  const dbInstance = getExecutor(tx);
  const safeDelta = assertResourceDeltaInRange(
    delta,
    RESOURCE_SAFETY.reputation.maxDelta,
  );

  const [updated] = await dbInstance
    .update(schema.cultivators)
    .set({
      reputation: sql`LEAST(
        ${RESOURCE_SAFETY.reputation.ceiling},
        ${schema.cultivators.reputation} + ${safeDelta}
      )`,
    })
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
        sql`${schema.cultivators.reputation} + ${safeDelta} >= 0`,
      ),
    )
    .returning({ value: schema.cultivators.reputation });

  if (updated) return updated.value;

  const [current] = await dbInstance
    .select({
      userId: schema.cultivators.userId,
      value: schema.cultivators.reputation,
    })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);
  if (!current || current.userId !== userId) {
    throw new Error('角色不存在或无权限操作');
  }
  if (safeDelta < 0) {
    throw new Error(`声望不足，需要 ${-safeDelta}，当前拥有 ${current.value}`);
  }
  throw new Error('声望更新失败');
}

/**
 * 更新角色寿元
 */
export async function updateLifespan(
  userId: string,
  cultivatorId: string,
  delta: number,
  tx?: DbTransaction,
): Promise<number> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);

  // [安全守卫] 夹紧变化量并施加上限
  const safeDelta = clampResourceDelta(
    delta,
    RESOURCE_SAFETY.lifespan.maxDelta,
  );

  const cultivator = await dbInstance
    .select({ lifespan: schema.cultivators.lifespan })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  if (cultivator.length === 0) {
    throw new Error('修真者不存在');
  }

  const newValue = Math.min(
    cultivator[0].lifespan + safeDelta,
    RESOURCE_SAFETY.lifespan.ceiling,
  );
  if (newValue < 0) {
    throw new Error(
      `寿元不足，需要 ${-safeDelta}，当前剩余 ${cultivator[0].lifespan}`,
    );
  }

  await dbInstance
    .update(schema.cultivators)
    .set({ lifespan: newValue })
    .where(eq(schema.cultivators.id, cultivatorId));
  return newValue;
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
): Promise<CultivationProgress> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
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

  // [安全守卫] 夹紧修为变化量并施加上限
  const safeExpDelta = clampResourceDelta(
    cultivationExpDelta,
    RESOURCE_SAFETY.cultivation_exp.maxDelta,
  );

  // 正向收益允许超过当前阶段 exp_cap；突破时会扣除本阶段 cap 并保留溢出。
  const cultivationExpCeiling = RESOURCE_SAFETY.cultivation_exp.ceiling;
  const newCultivationExp = Math.min(
    progress.cultivation_exp + safeExpDelta,
    cultivationExpCeiling,
  );
  if (newCultivationExp < 0) {
    throw new Error(
      `修为不足，需要 ${-safeExpDelta}，当前修为 ${progress.cultivation_exp}`,
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
  syncBottleneckState(updatedProgress);

  await dbInstance
    .update(schema.cultivators)
    .set({ cultivation_progress: stripExpCapForStorage(updatedProgress) })
    .where(eq(schema.cultivators.id, cultivatorId));
  return updatedProgress;
}

/**
 * 检查角色是否拥有足够数量的材料
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
