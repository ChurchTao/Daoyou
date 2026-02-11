// src/lib/utils.test.ts
import { db } from '@/lib/drizzle/db';
import { artifacts, consumables, skills } from '@/lib/drizzle/schema';
import { Artifact, Consumable, Skill } from '@/types/cultivator';
import { eq } from 'drizzle-orm';
import {
  calculateSingleArtifactScore,
  calculateSingleElixirScore,
  calculateSingleSkillScore,
} from './rankingUtils';

test('test 分数计算', async () => {
  //   遍历左右的法宝、神通、丹药，计算分数
  const artifactsAll = await db().select().from(artifacts);
  const skillsAll = await db().select().from(skills);
  const consumablesAll = await db().select().from(consumables);

  artifactsAll.forEach(async (artifact) => {
    const score = calculateSingleArtifactScore(artifact as Artifact);
    console.log('artifact', artifact.id, artifact.name, score);
    const update = await db()
      .update(artifacts)
      .set({ score })
      .where(eq(artifacts.id, artifact.id));
    console.log('artifact', update);
  });

  skillsAll.forEach(async (skill) => {
    const score = calculateSingleSkillScore(skill as unknown as Skill);
    const update = await db()
      .update(skills)
      .set({ score })
      .where(eq(skills.id, skill.id));
    console.log('skill', skill.id, skill.name, score, update);
  });

  consumablesAll.forEach(async (consumable) => {
    const score = calculateSingleElixirScore(consumable as Consumable);
    const update = await db()
      .update(consumables)
      .set({ score })
      .where(eq(consumables.id, consumable.id));
    console.log('consumable', consumable.id, consumable.name, score, update);
  });
});
