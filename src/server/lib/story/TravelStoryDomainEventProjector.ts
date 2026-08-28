import { db } from '@server/lib/drizzle/db';
import { storyIntents, storyMemories } from '@server/lib/drizzle/schema';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import { PERSONAL_STORY_FRAMEWORK_VERSION } from '@shared/lib/story/personalStory';
import {
  TravelStoryIntentPayloadSchema,
  shouldGenerateTravelStoryEvent,
  type ActivityStoryDecision,
} from '@shared/lib/story/travelStory';
import { and, eq, inArray } from 'drizzle-orm';
import {
  canAttemptActivityStoryCandidate,
  materializeActivityStoryCandidate,
  resolveActivityStoryDecision,
} from './ActivityStoryDirector';
import {
  PERSONAL_STORY_LIVE_EVENT_MAX_AGE_MS,
  PERSONAL_TRAVEL_STORY_CONSUMER_NAME,
  isPersonalStoryEnabledForCultivator,
  personalTravelStoryChance,
} from './constants';
import { personalStoryGenerator } from './PersonalStoryGenerator';
import {
  findStoryMemoryByFingerprint,
  listRecentStoryMemories,
  listStoryEntitiesByIds,
  loadActivityStoryIntentByDungeonRun,
  loadSectTaskStoryTriggerContext,
  loadStoryDungeonTriggerContext,
  loadStoryProjectionState,
  loadTravelStoryIntentState,
  loadTravelStoryTriggerContext,
  toThreadGenerationContext,
} from './PersonalStoryRepository';
import type { TravelStoryTriggerContext } from './types';

type ShortActivityDecision = Extract<
  ActivityStoryDecision,
  'travel_short' | 'sect_task_short'
>;

function isLiveEvent(event: DomainEventEnvelope): boolean {
  const age = Date.now() - new Date(event.occurredAt).getTime();
  return (
    Number.isFinite(age) &&
    age >= 0 &&
    age <= PERSONAL_STORY_LIVE_EVENT_MAX_AGE_MS
  );
}

async function resolveTrigger(event: DomainEventEnvelope): Promise<{
  context: TravelStoryTriggerContext;
  decision: ShortActivityDecision;
} | null> {
  if (isDomainEventType(event, 'yield.claimed')) {
    const context = await loadTravelStoryTriggerContext({ event });
    return context ? { context, decision: 'travel_short' } : null;
  }
  if (isDomainEventType(event, 'sect.task.completed')) {
    if (!isLiveEvent(event)) return null;
    const context = await loadSectTaskStoryTriggerContext({ event });
    return context ? { context, decision: 'sect_task_short' } : null;
  }
  return null;
}

async function projectLinkedActivityDungeonSettlement(
  event: DomainEventEnvelope<'dungeon.run.settled'>,
): Promise<{ status: 'applied' | 'already_processed' | 'ignored' }> {
  const linked = await loadActivityStoryIntentByDungeonRun(
    event.data.cultivatorId,
    event.data.runId,
  );
  if (!linked) return { status: 'ignored' };

  const context = await loadStoryDungeonTriggerContext({
    cultivatorId: event.data.cultivatorId,
    runId: event.data.runId,
    outcome: event.data.outcome,
    occurredAt: event.occurredAt,
  });
  const generation = isLiveEvent(event)
    ? await personalStoryGenerator.generateMemory(context)
    : personalStoryGenerator.generateMemoryFallback(context);

  const status = await db.transaction(async (tx) => {
    const claimed = await claimMessageForConsumer(
      {
        consumerName: PERSONAL_TRAVEL_STORY_CONSUMER_NAME,
        messageId: event.id,
        messageKey: event.type,
      },
      tx,
    );
    if (!claimed) return 'already_processed' as const;

    const current = await loadActivityStoryIntentByDungeonRun(
      event.data.cultivatorId,
      event.data.runId,
      tx,
      true,
    );
    if (!current) return 'ignored' as const;
    const choice = current.payload.choices.find(
      (candidate) => candidate.key === current.payload.selectedChoiceKey,
    );
    const occurredAt = new Date(event.occurredAt);
    const memoryFingerprint = `dungeon-run:${event.data.runId}`;

    await tx
      .insert(storyMemories)
      .values({
        cultivatorId: event.data.cultivatorId,
        sourceType: 'activity_story_dungeon',
        sourceId: event.data.runId,
        factFingerprint: memoryFingerprint,
        summary: generation.output.summary,
        tags: Array.from(
          new Set([
            ...(choice?.tags ?? []),
            ...generation.output.tags,
            '关联秘境',
          ]),
        ).slice(0, 8),
        entityIds: current.payload.entityRefs,
        importance: Math.max(3, generation.output.importance),
        evidence: {
          intentId: current.intent.id,
          runId: event.data.runId,
          mapNodeId: event.data.mapNodeId,
          outcome: event.data.outcome,
          selectedChoiceKey: current.payload.selectedChoiceKey,
          generationSource: generation.source,
          ...(generation.error ? { generationError: generation.error } : {}),
        },
        occurredAt,
      })
      .onConflictDoNothing();
    const storedMemory = await findStoryMemoryByFingerprint(
      event.data.cultivatorId,
      memoryFingerprint,
      tx,
    );
    if (!storedMemory) throw new Error('异闻关联秘境记忆写入失败');
    const summary = storedMemory.summary;

    const payload = TravelStoryIntentPayloadSchema.parse({
      ...current.payload,
      linkedDungeon: {
        ...current.payload.linkedDungeon,
        status: event.data.outcome,
        runId: event.data.runId,
        settledAt: event.occurredAt,
        endingSummary: summary,
      },
    });
    const [resolved] = await tx
      .update(storyIntents)
      .set({
        payload,
        status: 'resolved',
        requiresChoice: false,
        resolvedAt: occurredAt,
        lastError: generation.error ?? current.intent.lastError,
      })
      .where(
        and(
          eq(storyIntents.id, current.intent.id),
          eq(storyIntents.cultivatorId, event.data.cultivatorId),
          inArray(storyIntents.status, ['ready', 'delivered']),
        ),
      )
      .returning({ id: storyIntents.id });
    if (!resolved) throw new Error('异闻关联秘境结算状态写入失败');

    if (current.payload.director) {
      await resolveActivityStoryDecision({
        cultivatorId: event.data.cultivatorId,
        intentId: current.intent.id,
        tx,
      });
    }
    return 'applied' as const;
  });

  return { status };
}

export async function projectActivityStoryEvent(
  event: DomainEventEnvelope,
): Promise<{ status: 'applied' | 'already_processed' | 'ignored' }> {
  const cultivatorId =
    'cultivatorId' in event.data ? event.data.cultivatorId : null;
  if (!cultivatorId || !isPersonalStoryEnabledForCultivator(cultivatorId)) {
    return { status: 'ignored' };
  }

  if (isDomainEventType(event, 'dungeon.run.settled')) {
    return projectLinkedActivityDungeonSettlement(event);
  }

  const trigger = await resolveTrigger(event);
  if (!trigger) return { status: 'ignored' };
  const { context, decision } = trigger;
  const rootActivityId =
    context.journey.rootActivityId ??
    context.journey.activityId ??
    `${context.journey.activityType}:${context.journey.actionInstanceId}`;

  if (decision === 'travel_short') {
    const intentState = await loadTravelStoryIntentState(cultivatorId);
    if (
      !shouldGenerateTravelStoryEvent({
        hours: context.journey.hours,
        actionInstanceId: context.journey.actionInstanceId,
        hasPendingEvent: Boolean(intentState.pending),
        lastEventAt: intentState.lastEventAt,
        now: new Date(event.occurredAt),
        chance: personalTravelStoryChance(),
      })
    ) {
      return { status: 'ignored' };
    }
  }

  if (
    !(await canAttemptActivityStoryCandidate({
      cultivatorId,
      rootActivityId,
      sourceEventId: event.id,
      decision,
    }))
  ) {
    return { status: 'ignored' };
  }

  const memories = await listRecentStoryMemories(cultivatorId, 6);
  const projectionState = await loadStoryProjectionState(cultivatorId);
  if (
    decision === 'travel_short' &&
    projectionState.thread &&
    ['travel_prelude', 'aftermath'].includes(projectionState.thread.stage)
  ) {
    return { status: 'ignored' };
  }
  const entityIds = Array.from(
    new Set([
      ...memories.flatMap((memory) => memory.entityIds),
      ...(projectionState.entity ? [projectionState.entity.id] : []),
    ]),
  ).slice(0, 3);
  const entities = await listStoryEntitiesByIds(cultivatorId, entityIds);
  const generation = await personalStoryGenerator.generateActivityStory({
    context,
    memories,
    relatedEntities: entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      state: entity.state,
      relationship: entity.relationship,
      lifeStatus: entity.lifeStatus,
    })),
    activeThread: projectionState.thread
      ? toThreadGenerationContext({
          thread: projectionState.thread,
          entity: projectionState.entity,
        })
      : null,
  });

  const status = await db.transaction(async (tx) => {
    const claimed = await claimMessageForConsumer(
      {
        consumerName: PERSONAL_TRAVEL_STORY_CONSUMER_NAME,
        messageId: event.id,
        messageKey: event.type,
      },
      tx,
    );
    if (!claimed) return 'already_processed' as const;

    if (decision === 'travel_short') {
      const current = await loadTravelStoryIntentState(cultivatorId, tx);
      if (
        !shouldGenerateTravelStoryEvent({
          hours: context.journey.hours,
          actionInstanceId: context.journey.actionInstanceId,
          hasPendingEvent: Boolean(current.pending),
          lastEventAt: current.lastEventAt,
          now: new Date(event.occurredAt),
          chance: personalTravelStoryChance(),
        })
      ) {
        return 'ignored' as const;
      }
    }

    const payload = TravelStoryIntentPayloadSchema.parse({
      kind: 'activity_story',
      ...generation.output,
      source: context.journey,
    });
    const result = await materializeActivityStoryCandidate({
      cultivatorId,
      rootActivityId,
      sourceEventId: event.id,
      decision,
      payload,
      storyVersion: PERSONAL_STORY_FRAMEWORK_VERSION,
      lastError: generation.error,
      tx,
    });
    return result.status === 'ignored'
      ? ('ignored' as const)
      : ('applied' as const);
  });

  return { status };
}

export const projectPersonalTravelStoryEvent = projectActivityStoryEvent;
