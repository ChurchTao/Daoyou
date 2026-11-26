import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import { cultivatorStories } from '@server/lib/drizzle/schema.js';
import { parseStoryProgress } from '@daoyou/game-rules/story';
import type { StoryProgress } from '@daoyou/game-domain/story';
import { and, desc, eq } from 'drizzle-orm';

export type CultivatorStoryRecord = typeof cultivatorStories.$inferSelect;

function executor(q?: DbExecutor | DbTransaction) {
  return q ?? getExecutor();
}

function toProgress(row: CultivatorStoryRecord): StoryProgress {
  return parseStoryProgress({
    track: row.track,
    storyId: row.storyId,
    beatId: row.beatId,
    status: row.status,
    acks: row.acks,
    grants: row.grants,
    marks: row.marks,
  });
}

/** 一条线上的全部章节进度，新的在前。 */
export async function listCultivatorStories(
  cultivatorId: string,
  track: StoryProgress['track'],
  q?: DbExecutor | DbTransaction,
): Promise<StoryProgress[]> {
  const rows = await executor(q)
    .select()
    .from(cultivatorStories)
    .where(
      and(
        eq(cultivatorStories.cultivatorId, cultivatorId),
        eq(cultivatorStories.track, track),
      ),
    )
    .orderBy(desc(cultivatorStories.createdAt), desc(cultivatorStories.id));
  return rows.map(toProgress);
}

export async function insertCultivatorStory(
  cultivatorId: string,
  progress: StoryProgress,
  q: DbTransaction,
): Promise<void> {
  await q.insert(cultivatorStories).values({
    cultivatorId,
    track: progress.track,
    storyId: progress.storyId,
    beatId: progress.beatId,
    status: progress.status,
    acks: progress.acks,
    grants: progress.grants,
    marks: progress.marks,
  });
}

export async function updateCultivatorStory(
  cultivatorId: string,
  progress: StoryProgress,
  q: DbTransaction,
): Promise<void> {
  await q
    .update(cultivatorStories)
    .set({
      beatId: progress.beatId,
      status: progress.status,
      acks: progress.acks,
      grants: progress.grants,
      marks: progress.marks,
    })
    .where(
      and(
        eq(cultivatorStories.cultivatorId, cultivatorId),
        eq(cultivatorStories.track, progress.track),
        eq(cultivatorStories.storyId, progress.storyId),
      ),
    );
}
