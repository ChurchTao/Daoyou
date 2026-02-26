import { getExecutor, type DbExecutor } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { calculateSingleTechniqueScore } from '@/utils/rankingUtils';
import { CultivationTechnique } from '@/types/cultivator';
import { and, eq } from 'drizzle-orm';

export type CultivatorRecord = typeof schema.cultivators.$inferSelect;
export type SpiritualRootRecord = typeof schema.spiritualRoots.$inferSelect;
export type PreHeavenFateRecord = typeof schema.preHeavenFates.$inferSelect;
export type CultivationTechniqueRecord =
  typeof schema.cultivationTechniques.$inferSelect;
export type SkillRecord = typeof schema.skills.$inferSelect;
export type EquippedItemRecord = typeof schema.equippedItems.$inferSelect;
export type ArtifactRecord = typeof schema.artifacts.$inferSelect;

export interface CultivatorRelations {
  spiritualRoots: SpiritualRootRecord[];
  preHeavenFates: PreHeavenFateRecord[];
  cultivations: CultivationTechniqueRecord[];
  skills: SkillRecord[];
  equippedItems: EquippedItemRecord[];
  artifacts: ArtifactRecord[];
}

export async function loadCultivatorRelations(
  q: DbExecutor,
  cultivatorId: string,
): Promise<CultivatorRelations> {
  const spiritualRoots = await q
    .select()
    .from(schema.spiritualRoots)
    .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId));
  const preHeavenFates = await q
    .select()
    .from(schema.preHeavenFates)
    .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId));
  const cultivations = await q
    .select()
    .from(schema.cultivationTechniques)
    .where(eq(schema.cultivationTechniques.cultivatorId, cultivatorId));
  const pendingScoreUpdates = cultivations.filter((item) => (item.score || 0) <= 0);
  if (pendingScoreUpdates.length > 0) {
    await Promise.all(
      pendingScoreUpdates.map(async (item) => {
        const score = calculateSingleTechniqueScore({
          id: item.id,
          name: item.name,
          grade: item.grade as CultivationTechnique['grade'],
          required_realm: item.required_realm as CultivationTechnique['required_realm'],
          description: item.description || undefined,
          effects: (item.effects ?? []) as CultivationTechnique['effects'],
        });

        await q
          .update(schema.cultivationTechniques)
          .set({ score })
          .where(eq(schema.cultivationTechniques.id, item.id));

        item.score = score;
      }),
    );
  }
  const skills = await q
    .select()
    .from(schema.skills)
    .where(eq(schema.skills.cultivatorId, cultivatorId));
  const equippedItems = await q
    .select()
    .from(schema.equippedItems)
    .where(eq(schema.equippedItems.cultivatorId, cultivatorId));
  const artifacts = await q
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.cultivatorId, cultivatorId));

  return {
    spiritualRoots,
    preHeavenFates,
    cultivations,
    skills,
    equippedItems,
    artifacts,
  };
}

export async function findActiveCultivatorIdByUserId(
  userId: string,
  q: DbExecutor = getExecutor(),
): Promise<string | null> {
  const record = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return record[0]?.id ?? null;
}

export async function findActiveCultivatorRecordByUserId(
  userId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorRecord | null> {
  const records = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return records[0] ?? null;
}

export async function findActiveCultivatorRecordByIdAndUser(
  userId: string,
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorRecord | null> {
  const records = await q
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

  return records[0] ?? null;
}

export async function findActiveCultivatorRecordById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorRecord | null> {
  const records = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return records[0] ?? null;
}

export async function findCultivatorOwnerStatusById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<{ userId: string; status: string } | null> {
  const records = await q
    .select({
      userId: schema.cultivators.userId,
      status: schema.cultivators.status,
    })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  return records[0] ?? null;
}

export async function existsCultivatorById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  return rows.length > 0;
}

export async function hasCultivatorOwnership(
  userId: string,
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function hasDeadCultivatorByUserId(
  userId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
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
