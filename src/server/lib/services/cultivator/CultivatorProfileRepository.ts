import {
  findActiveCultivatorIdByUserId,
  hasCultivatorOwnership,
  hasDeadCultivatorByUserId,
} from '@server/lib/repositories/cultivatorRepository';
import type { PlayerIdentityCultivator } from '@shared/contracts/player';
import {
  clampSpiritualRootEffectiveStrength,
  SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
} from '@shared/lib/marrowWash';
import {
  ElementType,
  GenderType,
  Quality,
  RealmStage,
  RealmType,
  SpiritualRootGrade,
} from '@shared/types/constants';
import type { Cultivator, PreHeavenFate } from '@shared/types/cultivator';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  db,
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '../../drizzle/db';
import * as schema from '../../drizzle/schema';
import { ConditionService } from '../ConditionService';
import { FateEngine } from '../FateEngine';
import { assertCultivatorOwnership } from './CultivatorStateRepository';

export function mapSpiritualRoots(
  roots: Array<typeof schema.spiritualRoots.$inferSelect>,
): Cultivator['spiritual_roots'] {
  const spiritualRootCount = roots.length;
  return roots.map((r) => {
    const element = r.element as ElementType;
    const baseStrength = Math.max(0, Math.floor(r.strength));
    const marrowWashBonus = Math.max(0, Math.floor(r.marrowWashBonus ?? 0));
    return {
      element,
      strength: clampSpiritualRootEffectiveStrength(
        baseStrength + marrowWashBonus,
      ),
      baseStrength,
      marrowWashBonus,
      grade:
        (r.grade as SpiritualRootGrade) ??
        resolveSpiritualRootGrade(spiritualRootCount, element),
    };
  });
}

export function mapPreHeavenFatesForRuntime(
  fates: Array<typeof schema.preHeavenFates.$inferSelect>,
): Cultivator['pre_heaven_fates'] {
  return FateEngine.normalizeFates(
    fates.map((f): PreHeavenFate => ({
      name: f.name,
      quality: f.quality as Quality,
      description: f.description || undefined,
      effects:
        ((f.details as Record<string, unknown> | null)?.effects as
          PreHeavenFate['effects'] | undefined) || undefined,
      generationModel:
        ((f.details as Record<string, unknown> | null)?.generationModel as
          PreHeavenFate['generationModel'] | undefined) || undefined,
      namingMetadata:
        ((f.details as Record<string, unknown> | null)?.namingMetadata as
          PreHeavenFate['namingMetadata'] | undefined) || undefined,
    })),
  );
}

const mapPreHeavenFates = mapPreHeavenFatesForRuntime;

export async function getCultivatorPreHeavenFates(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<PreHeavenFate[]> {
  const q = executor ?? getExecutor();
  const rows = await q
    .select()
    .from(schema.preHeavenFates)
    .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId));
  return mapPreHeavenFates(rows);
}

export async function getPlayerPreHeavenFates(
  userId: string,
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<PreHeavenFate[] | null> {
  const q = executor ?? getExecutor();
  if (!(await hasCultivatorOwnership(userId, cultivatorId, q))) {
    return null;
  }
  return getCultivatorPreHeavenFates(cultivatorId, q);
}

function buildPreHeavenFateInsertValues(
  cultivatorId: string,
  fates: PreHeavenFate[],
) {
  const normalizedFates = FateEngine.normalizeFates(fates);

  return normalizedFates.map((fate) => ({
    cultivatorId,
    name: fate.name,
    quality: fate.quality || null,
    details: {
      effects: fate.effects ?? [],
      generationModel: fate.generationModel ?? null,
      namingMetadata: fate.namingMetadata ?? null,
    },
    description: fate.description || null,
  }));
}

/**
 * 创建角色（从临时表保存到正式表）
 */
export async function createCultivator(
  userId: string,
  cultivator: Cultivator,
  transaction?: DbTransaction,
): Promise<{ id: string }> {
  const create = async (tx: DbTransaction) => {
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
        playerRace: 'human',
        raceNarrative: cultivator.raceNarrative ?? '人身近道，百法皆可参悟。',
        realm: cultivator.realm,
        realm_stage: cultivator.realm_stage,
        age: cultivator.age,
        lifespan: cultivator.lifespan,
        closedDoorYearsTotal: cultivator.closed_door_years_total ?? 0,
        status: 'active',
        vitality: cultivator.attributes.vitality,
        strength: cultivator.attributes.strength,
        spirit: cultivator.attributes.spirit,
        endurance: cultivator.attributes.endurance,
        speed: cultivator.attributes.speed,
        willpower: cultivator.attributes.willpower,
        unallocatedAttributePoints:
          cultivator.unallocated_attribute_points ?? 0,
        condition: ConditionService.normalizeCondition(
          cultivator,
          cultivator.condition,
        ),
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
          strength: root.baseStrength ?? root.strength,
          marrowWashBonus: root.marrowWashBonus ?? 0,
          grade:
            root.grade ??
            resolveSpiritualRootGrade(spiritualRootCount, root.element),
        })),
      );
    }

    // 3. 创建先天命格
    if (normalizedFates.length > 0) {
      await tx
        .insert(schema.preHeavenFates)
        .values(buildPreHeavenFateInsertValues(cultivatorId, normalizedFates));
    }

    return cultivatorRecord;
  };
  const result = transaction
    ? await create(transaction)
    : await db.transaction(create);
  return { id: result.id };
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

export async function getPlayerIdentityCultivatorById(
  userId: string,
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<PlayerIdentityCultivator | null> {
  const q = executor ?? getExecutor();
  const [cultivatorRecord] = await q
    .select({
      id: schema.cultivators.id,
      createdAt: schema.cultivators.createdAt,
      name: schema.cultivators.name,
      title: schema.cultivators.title,
      gender: schema.cultivators.gender,
      origin: schema.cultivators.origin,
      personality: schema.cultivators.personality,
      background: schema.cultivators.background,
      prompt: schema.cultivators.prompt,
      playerRace: schema.cultivators.playerRace,
      raceNarrative: schema.cultivators.raceNarrative,
      realm: schema.cultivators.realm,
      realmStage: schema.cultivators.realm_stage,
      age: schema.cultivators.age,
      lifespan: schema.cultivators.lifespan,
      status: schema.cultivators.status,
      closedDoorYearsTotal: schema.cultivators.closedDoorYearsTotal,
      vitality: schema.cultivators.vitality,
      strength: schema.cultivators.strength,
      spirit: schema.cultivators.spirit,
      endurance: schema.cultivators.endurance,
      speed: schema.cultivators.speed,
      willpower: schema.cultivators.willpower,
      unallocatedAttributePoints: schema.cultivators.unallocatedAttributePoints,
      lastYieldAt: schema.cultivators.last_yield_at,
      balanceNotes: schema.cultivators.balance_notes,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!cultivatorRecord) return null;

  const [spiritualRoots, preHeavenFates] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(schema.spiritualRoots)
        .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId)),
    () =>
      q
        .select()
        .from(schema.preHeavenFates)
        .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId)),
  ]);
  return {
    id: cultivatorRecord.id,
    createdAt: cultivatorRecord.createdAt?.toISOString(),
    name: cultivatorRecord.name,
    title: cultivatorRecord.title || undefined,
    gender: (cultivatorRecord.gender as GenderType) || undefined,
    origin: cultivatorRecord.origin || undefined,
    personality: cultivatorRecord.personality || undefined,
    background: cultivatorRecord.background || undefined,
    prompt: cultivatorRecord.prompt,
    playerRace: cultivatorRecord.playerRace as Cultivator['playerRace'],
    raceNarrative: cultivatorRecord.raceNarrative ?? undefined,
    realm: cultivatorRecord.realm as RealmType,
    realm_stage: cultivatorRecord.realmStage as RealmStage,
    age: cultivatorRecord.age,
    lifespan: cultivatorRecord.lifespan,
    status: (cultivatorRecord.status as Cultivator['status']) ?? 'active',
    closed_door_years_total: cultivatorRecord.closedDoorYearsTotal ?? undefined,
    attributes: {
      vitality: cultivatorRecord.vitality,
      strength: cultivatorRecord.strength,
      spirit: cultivatorRecord.spirit,
      endurance: cultivatorRecord.endurance,
      speed: cultivatorRecord.speed,
      willpower: cultivatorRecord.willpower,
    },
    unallocated_attribute_points: cultivatorRecord.unallocatedAttributePoints,
    spiritual_roots: mapSpiritualRoots(spiritualRoots),
    pre_heaven_fates: mapPreHeavenFates(preHeavenFates),
    last_yield_at: cultivatorRecord.lastYieldAt?.toISOString(),
    balance_notes: cultivatorRecord.balanceNotes || undefined,
  };
}

export async function hasDeadCultivator(userId: string): Promise<boolean> {
  return hasDeadCultivatorByUserId(userId, getExecutor());
}

export async function getLastDeadCultivatorSummary(userId: string): Promise<{
  id: string;
  name: string;
  realm: Cultivator['realm'];
  realm_stage: Cultivator['realm_stage'];
  story?: string;
} | null> {
  const rows = await getExecutor()
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      realm: schema.cultivators.realm,
      realm_stage: schema.cultivators.realm_stage,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'dead'),
      ),
    )
    .orderBy(desc(schema.cultivators.updatedAt))
    .limit(1);

  if (rows.length === 0) return null;

  const record = rows[0];
  const history = await getExecutor()
    .select({ story: schema.breakthroughHistory.story })
    .from(schema.breakthroughHistory)
    .where(eq(schema.breakthroughHistory.cultivatorId, record.id))
    .orderBy(desc(schema.breakthroughHistory.createdAt))
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

export async function replaceSpiritualRoots(
  userId: string,
  cultivatorId: string,
  spiritualRoots: Cultivator['spiritual_roots'],
  tx?: DbTransaction,
): Promise<void> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
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
      strength: root.baseStrength ?? root.strength,
      marrowWashBonus: root.marrowWashBonus ?? 0,
      grade: root.grade ?? resolveSpiritualRootGrade(rootCount, root.element),
    })),
  );
}

export async function setSpiritualRootMarrowWashBonus(
  userId: string,
  cultivatorId: string,
  targetBonus: number,
  tx?: DbTransaction,
): Promise<void> {
  const bonus = Math.max(0, Math.floor(targetBonus));
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
  await dbInstance
    .update(schema.spiritualRoots)
    .set({
      marrowWashBonus: sql`least(${bonus}, greatest(0, ${SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP} - ${schema.spiritualRoots.strength}))`,
    })
    .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId));
}

export async function replacePreHeavenFates(
  userId: string,
  cultivatorId: string,
  fates: Cultivator['pre_heaven_fates'],
  tx?: DbTransaction,
): Promise<void> {
  const dbInstance = getExecutor(tx);
  await assertCultivatorOwnership(userId, cultivatorId, dbInstance);
  await dbInstance
    .delete(schema.preHeavenFates)
    .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId));

  if (fates.length === 0) {
    return;
  }

  await dbInstance
    .insert(schema.preHeavenFates)
    .values(buildPreHeavenFateInsertValues(cultivatorId, fates));
}
