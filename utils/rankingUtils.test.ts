import { db } from '@/lib/drizzle/db';
import { artifacts, consumables, skills } from '@/lib/drizzle/schema';
import { Artifact, Consumable, Skill } from '@/types/cultivator';
import { eq } from 'drizzle-orm';
import {
  calculateSingleArtifactScore,
  calculateSingleElixirScore,
  calculateSingleSkillScore,
} from './rankingUtils';

test('backfill: 刷新数据库中所有道具评分', async () => {
  const artifactsAll = await db().select().from(artifacts);
  const skillsAll = await db().select().from(skills);
  const consumablesAll = await db().select().from(consumables);

  let artifactUpdated = 0;
  let skillUpdated = 0;
  let consumableUpdated = 0;

  for (const artifact of artifactsAll) {
    const score = calculateSingleArtifactScore(artifact as Artifact);
    await db()
      .update(artifacts)
      .set({ score })
      .where(eq(artifacts.id, artifact.id));
    artifactUpdated += 1;
  }

  for (const skill of skillsAll) {
    const score = calculateSingleSkillScore(skill as unknown as Skill);
    await db().update(skills).set({ score }).where(eq(skills.id, skill.id));
    skillUpdated += 1;
  }

  for (const consumable of consumablesAll) {
    const score = calculateSingleElixirScore(consumable as Consumable);
    await db()
      .update(consumables)
      .set({ score })
      .where(eq(consumables.id, consumable.id));
    consumableUpdated += 1;
  }

  console.log(
    `backfill done: artifacts=${artifactUpdated}, skills=${skillUpdated}, consumables=${consumableUpdated}`,
  );
});
