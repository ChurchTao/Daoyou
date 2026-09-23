import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { cultivatorStories } from '@server/lib/drizzle/schema';
import { parseStoryProgress } from '@shared/story/catalog';
import type { StoryProgress } from '@shared/story/schema';
import { and, eq } from 'drizzle-orm';

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

export async function findCultivatorStory(
  cultivatorId: string,
  track: StoryProgress['track'],
  storyId: string,
  q?: DbExecutor | DbTransaction,
): Promise<StoryProgress | null> {
  const rows = await executor(q)
    .select()
    .from(cultivatorStories)
    .where(
      and(
        eq(cultivatorStories.cultivatorId, cultivatorId),
        eq(cultivatorStories.track, track),
        eq(cultivatorStories.storyId, storyId),
      ),
    )
    .limit(1);
  return rows[0] ? toProgress(rows[0]) : null;
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
