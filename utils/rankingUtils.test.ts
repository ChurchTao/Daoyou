import { db } from '@/lib/drizzle/db';
import {
  artifacts,
  consumables,
  cultivationTechniques,
  skills,
} from '@/lib/drizzle/schema';
import {
  Artifact,
  Consumable,
  CultivationTechnique,
  Skill,
} from '@/types/cultivator';
import { eq } from 'drizzle-orm';
import {
  calculateSingleArtifactScore,
  calculateSingleElixirScore,
  calculateSingleSkillScore,
  calculateSingleTechniqueScore,
} from './rankingUtils';

async function refreshArtifactScores(): Promise<number> {
  const rows = await db().select().from(artifacts);
  let updated = 0;

  for (const row of rows) {
    const score = calculateSingleArtifactScore(row as Artifact);
    await db().update(artifacts).set({ score }).where(eq(artifacts.id, row.id));
    updated += 1;
  }

  return updated;
}

async function refreshSkillScores(): Promise<number> {
  const rows = await db().select().from(skills);
  let updated = 0;

  for (const row of rows) {
    const score = calculateSingleSkillScore(row as unknown as Skill);
    await db().update(skills).set({ score }).where(eq(skills.id, row.id));
    updated += 1;
  }

  return updated;
}

async function refreshTechniqueScores(): Promise<number> {
  const rows = await db().select().from(cultivationTechniques);
  let updated = 0;

  for (const row of rows) {
    const score = calculateSingleTechniqueScore(
      row as unknown as CultivationTechnique,
    );
    await db()
      .update(cultivationTechniques)
      .set({ score })
      .where(eq(cultivationTechniques.id, row.id));
    updated += 1;
  }

  return updated;
}

async function refreshConsumableScores(): Promise<number> {
  const rows = await db().select().from(consumables);
  let updated = 0;

  for (const row of rows) {
    const score = calculateSingleElixirScore(row as Consumable);
    await db().update(consumables).set({ score }).where(eq(consumables.id, row.id));
    updated += 1;
  }

  return updated;
}

describe('backfill: 单项刷新评分', () => {
  test('刷新法宝评分', async () => {
    const updated = await refreshArtifactScores();
    console.log(`backfill done: artifacts=${updated}`);
  });

  test('刷新神通评分', async () => {
    const updated = await refreshSkillScores();
    console.log(`backfill done: skills=${updated}`);
  });

  test('刷新功法评分', async () => {
    const updated = await refreshTechniqueScores();
    console.log(`backfill done: techniques=${updated}`);
  });

  test('刷新丹药评分', async () => {
    const updated = await refreshConsumableScores();
    console.log(`backfill done: consumables=${updated}`);
  });
});
