import type { DbExecutor } from '@server/lib/drizzle/db';
import {
  storyEventLogs,
  storyProgress,
} from '@server/lib/drizzle/schema';
import type {
  StoryFlags,
  StoryNpcTrust,
  StoryProgressState,
} from '@server/lib/story/volume1Definition';
import { MAIN_STORY_V1_ID, MAIN_STORY_V1_VERSION } from '@shared/types/story';
import { and, eq } from 'drizzle-orm';

export interface StoryProgressRowInput {
  cultivatorId: string;
  currentNodeId: string;
  currentStep: string;
  flags: StoryFlags;
  npcTrust: StoryNpcTrust;
}

function mapProgressRow(row: typeof storyProgress.$inferSelect): StoryProgressState {
  return {
    storyId: row.storyId,
    storyVersion: row.storyVersion,
    status: row.status as StoryProgressState['status'],
    currentNodeId: row.currentNodeId,
    currentStep: row.currentStep,
    flags: (row.flags ?? {}) as StoryFlags,
    npcTrust: (row.npcTrust ?? {}) as StoryNpcTrust,
    completedAt: row.completedAt ?? null,
  };
}

export async function findStoryProgress(
  cultivatorId: string,
  q: DbExecutor,
): Promise<{ id: string; state: StoryProgressState } | null> {
  const row = await q.query.storyProgress.findFirst({
    where: and(
      eq(storyProgress.cultivatorId, cultivatorId),
      eq(storyProgress.storyId, MAIN_STORY_V1_ID),
    ),
  });
  return row ? { id: row.id, state: mapProgressRow(row) } : null;
}

export async function createStoryProgressIfMissing(
  input: StoryProgressRowInput,
  q: DbExecutor,
): Promise<void> {
  await q
    .insert(storyProgress)
    .values({
      cultivatorId: input.cultivatorId,
      storyId: MAIN_STORY_V1_ID,
      storyVersion: MAIN_STORY_V1_VERSION,
      status: 'active',
      currentNodeId: input.currentNodeId,
      currentStep: input.currentStep,
      flags: input.flags,
      npcTrust: input.npcTrust,
    })
    .onConflictDoNothing({
      target: [storyProgress.cultivatorId, storyProgress.storyId],
    });
}

export async function updateStoryProgress(
  args: {
    id: string;
    expectedNodeId: string;
    expectedStep: string;
    next: StoryProgressState;
  },
  q: DbExecutor,
): Promise<StoryProgressState | null> {
  const [row] = await q
    .update(storyProgress)
    .set({
      storyVersion: args.next.storyVersion,
      status: args.next.status,
      currentNodeId: args.next.currentNodeId,
      currentStep: args.next.currentStep,
      flags: args.next.flags,
      npcTrust: args.next.npcTrust,
      completedAt: args.next.completedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(storyProgress.id, args.id),
        eq(storyProgress.currentNodeId, args.expectedNodeId),
        eq(storyProgress.currentStep, args.expectedStep),
      ),
    )
    .returning();
  return row ? mapProgressRow(row) : null;
}

export async function findStoryEventByDedupeKey(
  cultivatorId: string,
  dedupeKey: string,
  q: DbExecutor,
): Promise<typeof storyEventLogs.$inferSelect | null> {
  return (
    (await q.query.storyEventLogs.findFirst({
      where: and(
        eq(storyEventLogs.cultivatorId, cultivatorId),
        eq(storyEventLogs.dedupeKey, dedupeKey),
      ),
    })) ?? null
  );
}

export async function appendStoryEvent(
  args: {
    cultivatorId: string;
    nodeId: string;
    sceneKey?: string | null;
    eventType: string;
    choiceId?: string | null;
    payload?: Record<string, unknown>;
    dedupeKey: string;
  },
  q: DbExecutor,
): Promise<void> {
  await q.insert(storyEventLogs).values({
    cultivatorId: args.cultivatorId,
    storyId: MAIN_STORY_V1_ID,
    storyVersion: MAIN_STORY_V1_VERSION,
    nodeId: args.nodeId,
    sceneKey: args.sceneKey ?? null,
    eventType: args.eventType,
    choiceId: args.choiceId ?? null,
    payload: args.payload ?? {},
    dedupeKey: args.dedupeKey,
  });
}
