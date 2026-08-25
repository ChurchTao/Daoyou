import { db } from '@server/lib/drizzle/db';
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
import {
  canAttemptActivityStoryCandidate,
  materializeActivityStoryCandidate,
} from './ActivityStoryDirector';
import {
  PERSONAL_STORY_LIVE_EVENT_MAX_AGE_MS,
  PERSONAL_TRAVEL_STORY_CONSUMER_NAME,
  isPersonalStoryEnabledForCultivator,
  personalTravelStoryChance,
} from './constants';
import { personalStoryGenerator } from './PersonalStoryGenerator';
import {
  listRecentStoryMemories,
  listStoryEntitiesByIds,
  loadSectTaskStoryTriggerContext,
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

export async function projectActivityStoryEvent(
  event: DomainEventEnvelope,
): Promise<{ status: 'applied' | 'already_processed' | 'ignored' }> {
  const cultivatorId =
    'cultivatorId' in event.data ? event.data.cultivatorId : null;
  if (!cultivatorId || !isPersonalStoryEnabledForCultivator(cultivatorId)) {
    return { status: 'ignored' };
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
