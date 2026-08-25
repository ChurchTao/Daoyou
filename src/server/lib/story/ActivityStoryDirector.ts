import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  storyActivityDecisions,
  storyIntents,
} from '@server/lib/drizzle/schema';
import type { StoryThreadScope } from '@shared/lib/story/personalStory';
import {
  ACTIVITY_STORY_DIRECTOR_PRIORITY,
  TravelStoryIntentPayloadSchema,
  shouldReplaceActivityStoryDecision,
  type ActivityStoryDecision,
  type TravelStoryIntentPayload,
} from '@shared/lib/story/travelStory';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

type DirectorResult = 'applied' | 'upgraded' | 'ignored';

export async function canAttemptActivityStoryCandidate(input: {
  cultivatorId: string;
  rootActivityId: string;
  sourceEventId: string;
  decision: Extract<
    ActivityStoryDecision,
    'travel_short' | 'dungeon_short' | 'sect_task_short'
  >;
  q?: DbExecutor;
}): Promise<boolean> {
  const q = input.q ?? getExecutor();
  const [current] = await q
    .select()
    .from(storyActivityDecisions)
    .where(
      and(
        eq(storyActivityDecisions.cultivatorId, input.cultivatorId),
        eq(storyActivityDecisions.rootActivityId, input.rootActivityId),
      ),
    )
    .limit(1);
  if (!current) return true;
  if (
    current.sourceEventId === input.sourceEventId &&
    current.decision === input.decision
  ) {
    return false;
  }
  return shouldReplaceActivityStoryDecision({
    current: current.decision,
    candidate: input.decision,
    currentResolved: current.status === 'resolved',
  });
}

async function lockActivityRoot(
  cultivatorId: string,
  rootActivityId: string,
  tx: DbTransaction,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${cultivatorId}:${rootActivityId}`}, 0))`,
  );
  const [current] = await tx
    .select()
    .from(storyActivityDecisions)
    .where(
      and(
        eq(storyActivityDecisions.cultivatorId, cultivatorId),
        eq(storyActivityDecisions.rootActivityId, rootActivityId),
      ),
    )
    .for('update')
    .limit(1);
  return current ?? null;
}

export async function materializeActivityStoryCandidate(input: {
  cultivatorId: string;
  rootActivityId: string;
  sourceEventId: string;
  decision: Extract<
    ActivityStoryDecision,
    'travel_short' | 'dungeon_short' | 'sect_task_short'
  >;
  payload: TravelStoryIntentPayload;
  storyVersion: number;
  availableAt?: Date;
  lastError?: string;
  tx: DbTransaction;
}): Promise<{ status: DirectorResult; intentId?: string }> {
  const priority = ACTIVITY_STORY_DIRECTOR_PRIORITY[input.decision];
  const current = await lockActivityRoot(
    input.cultivatorId,
    input.rootActivityId,
    input.tx,
  );
  const payload = TravelStoryIntentPayloadSchema.parse({
    ...input.payload,
    kind: 'activity_story',
    director: {
      decision: input.decision,
      priority,
      rootActivityId: input.rootActivityId,
      sourceEventId: input.sourceEventId,
    },
  });

  if (current) {
    if (
      current.sourceEventId === input.sourceEventId &&
      current.decision === input.decision
    ) {
      return {
        status: 'ignored',
        ...(current.intentId ? { intentId: current.intentId } : {}),
      };
    }
    if (
      !shouldReplaceActivityStoryDecision({
        current: current.decision,
        candidate: input.decision,
        currentResolved: current.status === 'resolved',
      })
    ) {
      return { status: 'ignored' };
    }

    const [existingIntent] = current.intentId
      ? await input.tx
          .select()
          .from(storyIntents)
          .where(
            and(
              eq(storyIntents.id, current.intentId),
              eq(storyIntents.cultivatorId, input.cultivatorId),
            ),
          )
          .for('update')
          .limit(1)
      : [];
    if (existingIntent?.status === 'resolved') {
      await input.tx
        .update(storyActivityDecisions)
        .set({
          status: 'resolved',
          resolvedAt: existingIntent.resolvedAt ?? new Date(),
        })
        .where(eq(storyActivityDecisions.id, current.id));
      return { status: 'ignored' };
    }

    const intentId = existingIntent?.id ?? randomUUID();
    if (existingIntent) {
      await input.tx
        .update(storyIntents)
        .set({
          storyVersion: input.storyVersion,
          beatType: 'activity_story',
          sourceType: 'activity_root',
          sourceId: input.rootActivityId,
          payload,
          requiresChoice: true,
          status: 'delivered',
          deliveredVia: 'activity_modal',
          availableAt: input.availableAt ?? new Date(),
          lastError: input.lastError,
        })
        .where(eq(storyIntents.id, existingIntent.id));
    } else {
      await input.tx.insert(storyIntents).values({
        id: intentId,
        cultivatorId: input.cultivatorId,
        threadId: null,
        storyVersion: input.storyVersion,
        beatType: 'activity_story',
        sourceType: 'activity_root',
        sourceId: input.rootActivityId,
        payload,
        requiresChoice: true,
        status: 'delivered',
        deliveredVia: 'activity_modal',
        availableAt: input.availableAt ?? new Date(),
        lastError: input.lastError,
      });
    }
    await input.tx
      .update(storyActivityDecisions)
      .set({
        decision: input.decision,
        priority,
        threadScope: null,
        sourceEventId: input.sourceEventId,
        intentId,
        status: 'materialized',
        resolvedAt: null,
      })
      .where(eq(storyActivityDecisions.id, current.id));
    return { status: 'upgraded', intentId };
  }

  const intentId = randomUUID();
  await input.tx.insert(storyIntents).values({
    id: intentId,
    cultivatorId: input.cultivatorId,
    threadId: null,
    storyVersion: input.storyVersion,
    beatType: 'activity_story',
    sourceType: 'activity_root',
    sourceId: input.rootActivityId,
    payload,
    requiresChoice: true,
    status: 'delivered',
    deliveredVia: 'activity_modal',
    availableAt: input.availableAt ?? new Date(),
    lastError: input.lastError,
  });
  await input.tx.insert(storyActivityDecisions).values({
    cultivatorId: input.cultivatorId,
    rootActivityId: input.rootActivityId,
    decision: input.decision,
    priority,
    sourceEventId: input.sourceEventId,
    intentId,
    status: 'materialized',
  });
  return { status: 'applied', intentId };
}

export async function recordMainlineActivityDecision(input: {
  cultivatorId: string;
  rootActivityId: string;
  sourceEventId: string;
  decision: Extract<
    ActivityStoryDecision,
    'mainline_omen' | 'sect_mainline' | 'mainline_dungeon'
  >;
  threadScope: StoryThreadScope;
  tx: DbTransaction;
}): Promise<DirectorResult> {
  const priority = ACTIVITY_STORY_DIRECTOR_PRIORITY[input.decision];
  const current = await lockActivityRoot(
    input.cultivatorId,
    input.rootActivityId,
    input.tx,
  );
  if (current) {
    if (
      current.sourceEventId === input.sourceEventId &&
      current.decision === input.decision
    ) {
      return 'ignored';
    }
    if (
      !shouldReplaceActivityStoryDecision({
        current: current.decision,
        candidate: input.decision,
        currentResolved: current.status === 'resolved',
      })
    ) {
      return 'ignored';
    }
    if (current.intentId) {
      await input.tx
        .update(storyIntents)
        .set({
          status: 'failed',
          requiresChoice: false,
          lastError: '已由同一活动的高优先级主线剧情替代',
        })
        .where(
          and(
            eq(storyIntents.id, current.intentId),
            eq(storyIntents.cultivatorId, input.cultivatorId),
            inArray(storyIntents.status, ['ready', 'delivered']),
          ),
        );
    }
    await input.tx
      .update(storyActivityDecisions)
      .set({
        decision: input.decision,
        priority,
        threadScope: input.threadScope,
        sourceEventId: input.sourceEventId,
        intentId: null,
        status: 'reserved',
        resolvedAt: null,
      })
      .where(eq(storyActivityDecisions.id, current.id));
    return 'upgraded';
  }

  await input.tx.insert(storyActivityDecisions).values({
    cultivatorId: input.cultivatorId,
    rootActivityId: input.rootActivityId,
    decision: input.decision,
    priority,
    threadScope: input.threadScope,
    sourceEventId: input.sourceEventId,
    intentId: null,
    status: 'reserved',
  });
  return 'applied';
}

export async function resolveActivityStoryDecision(input: {
  cultivatorId: string;
  intentId: string;
  tx: DbTransaction;
}) {
  await input.tx
    .update(storyActivityDecisions)
    .set({ status: 'resolved', resolvedAt: new Date() })
    .where(
      and(
        eq(storyActivityDecisions.cultivatorId, input.cultivatorId),
        eq(storyActivityDecisions.intentId, input.intentId),
        inArray(storyActivityDecisions.status, ['materialized', 'reserved']),
      ),
    );
}
