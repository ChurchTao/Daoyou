import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import {
  cultivators,
  dungeonRuns,
  storyEntities,
  storyIntents,
  storyMemories,
  storyStates,
  storyThreads,
} from '@server/lib/drizzle/schema';
import type { DungeonState } from '@server/lib/dungeon/types';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import {
  deriveStoryArchiveProgress,
  DungeonStoryContextSchema,
  PERSONAL_STORY_FRAMEWORK_ID,
  PERSONAL_STORY_FRAMEWORK_TITLE,
  StoryArchiveResponseSchema,
  StoryChoiceKeySchema,
  StoryIntentPayloadSchema,
  StoryMailDescriptorSchema,
  type StoryMailDescriptor,
} from '@shared/lib/story/personalStory';
import {
  TravelStoryEventSchema,
  TravelStoryIntentPayloadSchema,
  type TravelStoryEvent,
} from '@shared/lib/story/travelStory';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import type {
  StoryDungeonTriggerContext,
  StoryMemoryReference,
  StoryThreadGenerationContext,
  TravelStoryTriggerContext,
} from './types';

export async function loadTravelStoryTriggerContext(input: {
  event: DomainEventEnvelope<'yield.claimed'>;
  q?: DbExecutor;
}): Promise<TravelStoryTriggerContext | null> {
  if (!input.event.data.hours || !input.event.data.realmStage) return null;
  const q = input.q ?? getExecutor();
  const [cultivator] = await q
    .select({
      id: cultivators.id,
      name: cultivators.name,
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
      personality: cultivators.personality,
      background: cultivators.background,
    })
    .from(cultivators)
    .where(eq(cultivators.id, input.event.data.cultivatorId))
    .limit(1);
  if (!cultivator) return null;

  return {
    cultivator: {
      ...cultivator,
      realm: input.event.data.realm,
      realmStage: input.event.data.realmStage,
    },
    journey: {
      actionInstanceId: input.event.data.actionInstanceId,
      hours: input.event.data.hours,
      realm: input.event.data.realm,
      realmStage: input.event.data.realmStage,
      activityType: 'travel',
      activityId: `travel:${input.event.data.actionInstanceId}`,
      rootActivityId: `travel:${input.event.data.actionInstanceId}`,
      title: '云游历练',
      summary: `完成${input.event.data.hours}小时云游历练。`,
    },
    occurredAt: input.event.occurredAt,
  };
}

export async function loadSectTaskStoryTriggerContext(input: {
  event: DomainEventEnvelope<'sect.task.completed'>;
  q?: DbExecutor;
}): Promise<TravelStoryTriggerContext | null> {
  const q = input.q ?? getExecutor();
  const [cultivator] = await q
    .select({
      id: cultivators.id,
      name: cultivators.name,
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
      personality: cultivators.personality,
      background: cultivators.background,
    })
    .from(cultivators)
    .where(eq(cultivators.id, input.event.data.cultivatorId))
    .limit(1);
  if (!cultivator) return null;

  return {
    cultivator: {
      ...cultivator,
      realm: input.event.data.rewardSnapshot.realm,
      realmStage: input.event.data.rewardSnapshot.realmStage,
    },
    journey: {
      actionInstanceId: input.event.id,
      hours: 4,
      realm: input.event.data.rewardSnapshot.realm,
      realmStage: input.event.data.rewardSnapshot.realmStage,
      activityType: 'sect_task',
      activityId: input.event.data.activityId,
      rootActivityId: input.event.data.rootActivityId,
      title: input.event.data.taskTitle,
      summary: input.event.data.authoritativeSummary,
    },
    occurredAt: input.event.occurredAt,
  };
}

export async function loadTravelStoryIntentState(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<{
  pending: typeof storyIntents.$inferSelect | null;
  lastEventAt: Date | null;
}> {
  const [pendingRows, latestRows] = await Promise.all([
    q
      .select()
      .from(storyIntents)
      .where(
        and(
          eq(storyIntents.cultivatorId, cultivatorId),
          inArray(storyIntents.beatType, [
            'travel_event',
            'activity_story',
            'travel_prelude',
            'travel_echo',
          ]),
          inArray(storyIntents.status, ['ready', 'delivered']),
          lte(storyIntents.availableAt, new Date()),
        ),
      )
      .orderBy(
        sql`case
          when ${storyIntents.beatType} = 'travel_echo' then 0
          when ${storyIntents.beatType} = 'travel_prelude' then 1
          else 2
        end`,
        desc(storyIntents.createdAt),
      )
      .limit(1),
    q
      .select({ createdAt: storyIntents.createdAt })
      .from(storyIntents)
      .where(
        and(
          eq(storyIntents.cultivatorId, cultivatorId),
          eq(storyIntents.beatType, 'travel_event'),
        ),
      )
      .orderBy(desc(storyIntents.createdAt))
      .limit(1),
  ]);
  return {
    pending: pendingRows[0] ?? null,
    lastEventAt: latestRows[0]?.createdAt ?? null,
  };
}

export async function loadOwnedTravelStoryIntent(
  cultivatorId: string,
  intentId: string,
  q: DbExecutor = getExecutor(),
  lock = false,
) {
  let query = q
    .select()
    .from(storyIntents)
    .where(
      and(
        eq(storyIntents.id, intentId),
        eq(storyIntents.cultivatorId, cultivatorId),
        inArray(storyIntents.beatType, [
          'travel_event',
          'activity_story',
          'travel_prelude',
          'travel_echo',
        ]),
      ),
    )
    .limit(1);
  if (lock) query = query.for('update') as typeof query;
  const [intent] = await query;
  if (!intent) return null;
  const payload = TravelStoryIntentPayloadSchema.parse(intent.payload);
  return { intent, payload };
}

export function toTravelStoryEvent(input: {
  intent: typeof storyIntents.$inferSelect;
  payload: ReturnType<typeof TravelStoryIntentPayloadSchema.parse>;
}): TravelStoryEvent {
  return TravelStoryEventSchema.parse({
    id: input.intent.id,
    eventType: input.payload.eventType,
    activityType: input.payload.source.activityType,
    title: input.payload.title,
    content: input.payload.content,
    choices: input.payload.choices.map((choice) => ({
      key: choice.key,
      label: choice.label,
      description: choice.description,
      rewardKind: choice.rewardKind,
    })),
    status: input.intent.status === 'resolved' ? 'resolved' : 'awaiting_choice',
    selectedChoiceKey: input.payload.selectedChoiceKey,
    selectedOutcome: input.payload.selectedOutcome,
    selectedReward: input.payload.selectedReward,
    linkage: input.payload.linkage,
    createdAt: input.intent.createdAt.toISOString(),
  });
}

export async function loadPendingTravelStoryEvent(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<TravelStoryEvent | null> {
  const state = await loadTravelStoryIntentState(cultivatorId, q);
  if (!state.pending) return null;
  const payload = TravelStoryIntentPayloadSchema.parse(state.pending.payload);
  return toTravelStoryEvent({ intent: state.pending, payload });
}

export async function loadStoryDungeonTriggerContext(input: {
  cultivatorId: string;
  runId: string;
  outcome: StoryDungeonTriggerContext['run']['outcome'];
  occurredAt: string;
  q?: DbExecutor;
}): Promise<StoryDungeonTriggerContext> {
  const q = input.q ?? getExecutor();
  const [cultivatorRows, runRows] = await Promise.all([
    q
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        personality: cultivators.personality,
        background: cultivators.background,
      })
      .from(cultivators)
      .where(eq(cultivators.id, input.cultivatorId))
      .limit(1),
    q
      .select({
        id: dungeonRuns.id,
        mapNodeId: dungeonRuns.mapNodeId,
        runState: dungeonRuns.runState,
      })
      .from(dungeonRuns)
      .where(
        and(
          eq(dungeonRuns.id, input.runId),
          eq(dungeonRuns.cultivatorId, input.cultivatorId),
        ),
      )
      .limit(1),
  ]);

  const cultivator = cultivatorRows[0];
  const run = runRows[0];
  if (!cultivator || !run) {
    throw new Error('个人剧情无法读取对应的角色或秘境记录');
  }

  const state = run.runState as DungeonState;
  return {
    cultivator,
    run: {
      id: run.id,
      mapNodeId: run.mapNodeId,
      theme: state.theme || state.location?.location || '无名秘境',
      outcome: input.outcome,
      history: (state.history ?? []).map((entry) => ({
        round: entry.round,
        scene: entry.scene,
        choice: entry.choice,
        outcome: entry.outcome,
        gainedItems: entry.gained_items,
      })),
      endingNarrative: state.settlement?.ending_narrative,
      defeatedEnemyNames: state.defeatedEnemyNames ?? [],
      accumulatedRewards: (state.accumulatedRewards ?? []).map((reward) => ({
        name: reward.name,
        description: reward.description,
      })),
      storyContext: state.storyContext
        ? DungeonStoryContextSchema.safeParse(state.storyContext).data
        : undefined,
    },
    occurredAt: input.occurredAt,
  };
}

export async function findStoryMemoryByFingerprint(
  cultivatorId: string,
  factFingerprint: string,
  q: DbExecutor = getExecutor(),
): Promise<StoryMemoryReference | null> {
  const [memory] = await q
    .select({
      id: storyMemories.id,
      summary: storyMemories.summary,
      tags: storyMemories.tags,
      importance: storyMemories.importance,
      entityIds: storyMemories.entityIds,
      evidence: storyMemories.evidence,
    })
    .from(storyMemories)
    .where(
      and(
        eq(storyMemories.cultivatorId, cultivatorId),
        eq(storyMemories.factFingerprint, factFingerprint),
      ),
    )
    .limit(1);
  return memory ?? null;
}

export async function listRecentStoryMemories(
  cultivatorId: string,
  limit = 6,
  q: DbExecutor = getExecutor(),
): Promise<StoryMemoryReference[]> {
  return q
    .select({
      id: storyMemories.id,
      summary: storyMemories.summary,
      tags: storyMemories.tags,
      importance: storyMemories.importance,
      entityIds: storyMemories.entityIds,
      evidence: storyMemories.evidence,
    })
    .from(storyMemories)
    .where(eq(storyMemories.cultivatorId, cultivatorId))
    .orderBy(desc(storyMemories.occurredAt))
    .limit(limit);
}

export async function listDuePersonalStoryCultivatorIds(
  now = new Date(),
  q: DbExecutor = getExecutor(),
): Promise<string[]> {
  const rows = await q
    .select({ cultivatorId: storyStates.cultivatorId })
    .from(storyStates)
    .where(
      and(
        isNull(storyStates.activeThreadId),
        isNotNull(storyStates.cooldownUntil),
        lte(storyStates.cooldownUntil, now),
      ),
    );
  return rows.map((row) => row.cultivatorId);
}

export async function loadLatestDungeonStorySeed(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<{
  memory: StoryMemoryReference;
  runId: string;
  occurredAt: string;
} | null> {
  const [row] = await q
    .select({
      id: storyMemories.id,
      summary: storyMemories.summary,
      tags: storyMemories.tags,
      importance: storyMemories.importance,
      entityIds: storyMemories.entityIds,
      evidence: storyMemories.evidence,
      runId: storyMemories.sourceId,
      occurredAt: storyMemories.occurredAt,
    })
    .from(storyMemories)
    .where(
      and(
        eq(storyMemories.cultivatorId, cultivatorId),
        eq(storyMemories.sourceType, 'dungeon_run'),
      ),
    )
    .orderBy(desc(storyMemories.occurredAt))
    .limit(1);
  if (!row) return null;

  return {
    memory: {
      id: row.id,
      summary: row.summary,
      tags: row.tags,
      importance: row.importance,
      entityIds: row.entityIds,
      evidence: row.evidence,
    },
    runId: row.runId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

export async function listStoryEntitiesByIds(
  cultivatorId: string,
  entityIds: string[],
  q: DbExecutor = getExecutor(),
) {
  if (entityIds.length === 0) return [];
  return q
    .select()
    .from(storyEntities)
    .where(
      and(
        eq(storyEntities.cultivatorId, cultivatorId),
        inArray(storyEntities.id, entityIds),
      ),
    );
}

export async function loadPersonalStoryArchive(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
) {
  const [stateRows, threads, totalRows] = await Promise.all([
    q
      .select({
        activeThreadId: storyStates.activeThreadId,
        activeSectThreadId: storyStates.activeSectThreadId,
      })
      .from(storyStates)
      .where(eq(storyStates.cultivatorId, cultivatorId))
      .limit(1),
    q
      .select()
      .from(storyThreads)
      .where(eq(storyThreads.cultivatorId, cultivatorId))
      .orderBy(desc(storyThreads.createdAt))
      .limit(30),
    q
      .select({ value: count() })
      .from(storyThreads)
      .where(eq(storyThreads.cultivatorId, cultivatorId)),
  ]);
  if (threads.length === 0) {
    return StoryArchiveResponseSchema.parse({
      current: null,
      currentPersonal: null,
      currentSect: null,
      history: [],
      total: 0,
    });
  }

  const threadIds = threads.map((thread) => thread.id);
  const entityIds = Array.from(
    new Set(threads.flatMap((thread) => thread.entityIds)),
  );
  const runIds = threads.flatMap((thread) =>
    thread.linkedRunId ? [thread.linkedRunId] : [],
  );
  const [intents, entities, runs] = await Promise.all([
    q
      .select()
      .from(storyIntents)
      .where(
        and(
          eq(storyIntents.cultivatorId, cultivatorId),
          inArray(storyIntents.threadId, threadIds),
        ),
      )
      .orderBy(storyIntents.createdAt),
    entityIds.length > 0
      ? listStoryEntitiesByIds(cultivatorId, entityIds, q)
      : Promise.resolve([]),
    runIds.length > 0
      ? q
          .select({
            id: dungeonRuns.id,
            status: dungeonRuns.status,
            currentRound: dungeonRuns.currentRound,
            maxRounds: dungeonRuns.maxRounds,
          })
          .from(dungeonRuns)
          .where(
            and(
              eq(dungeonRuns.cultivatorId, cultivatorId),
              inArray(dungeonRuns.id, runIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  const intentsByThread = new Map<string, Array<(typeof intents)[number]>>();
  for (const intent of intents) {
    if (!intent.threadId) continue;
    const current = intentsByThread.get(intent.threadId) ?? [];
    current.push(intent);
    intentsByThread.set(intent.threadId, current);
  }
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const runById = new Map(runs.map((run) => [run.id, run]));
  const explicitActiveThreadId = stateRows[0]?.activeThreadId ?? null;
  const explicitActiveSectThreadId = stateRows[0]?.activeSectThreadId ?? null;
  const fallbackActiveThreadId = threads.find(
    (thread) =>
      thread.threadScope === 'personal' &&
      ['active', 'paused'].includes(thread.status),
  )?.id;
  const fallbackActiveSectThreadId = threads.find(
    (thread) =>
      thread.threadScope === 'sect' &&
      ['active', 'paused'].includes(thread.status),
  )?.id;
  const activeThreadId = explicitActiveThreadId ?? fallbackActiveThreadId;
  const activeSectThreadId =
    explicitActiveSectThreadId ?? fallbackActiveSectThreadId;

  const entries = threads.map((thread) => {
    const threadIntents = intentsByThread.get(thread.id) ?? [];
    const parsedStoryIntents = threadIntents.flatMap((intent) => {
      const parsed = StoryIntentPayloadSchema.safeParse(intent.payload);
      return parsed.success ? [{ intent, payload: parsed.data }] : [];
    });
    const parsedTravelIntents = threadIntents.flatMap((intent) => {
      const parsed = TravelStoryIntentPayloadSchema.safeParse(intent.payload);
      if (!parsed.success) return [];
      if (
        intent.beatType === 'travel_echo' &&
        intent.status !== 'resolved' &&
        intent.availableAt > new Date()
      ) {
        return [];
      }
      return [{ intent, payload: parsed.data }];
    });
    const omen = parsedStoryIntents.find(
      ({ intent }) => intent.beatType === 'omen',
    );
    const aftermath = parsedStoryIntents.find(
      ({ intent }) => intent.beatType === 'aftermath',
    );
    const selectedChoice = omen?.payload.choices.find(
      (choice) => choice.key === thread.selectedChoiceKey,
    );
    const selectedChoiceKey = thread.selectedChoiceKey
      ? StoryChoiceKeySchema.safeParse(thread.selectedChoiceKey).data
      : undefined;
    const linkedRun = thread.linkedRunId
      ? runById.get(thread.linkedRunId)
      : undefined;
    const isCurrent =
      thread.id === activeThreadId || thread.id === activeSectThreadId;

    return {
      id: thread.id,
      frameworkTitle: PERSONAL_STORY_FRAMEWORK_TITLE,
      threadScope: thread.threadScope,
      title:
        omen?.payload.title ??
        aftermath?.payload.title ??
        PERSONAL_STORY_FRAMEWORK_TITLE,
      premise: thread.premise,
      status: thread.status,
      stage: thread.stage,
      isCurrent,
      progress: deriveStoryArchiveProgress({
        stage: thread.stage,
        status: thread.status,
        linkedRunId: thread.linkedRunId,
        linkedRunStatus: linkedRun?.status,
      }),
      selectedChoiceKey,
      selectedChoiceLabel:
        selectedChoice?.label ??
        (selectedChoiceKey === 'intervene_now'
          ? '立即介入'
          : selectedChoiceKey === 'investigate_first'
            ? '先行调查'
            : selectedChoiceKey === 'delay'
              ? '旧数据：暂缓处理'
              : undefined),
      nextHook: aftermath?.payload.nextHook ?? thread.unresolvedQuestion,
      entities: thread.entityIds.flatMap((entityId) => {
        const entity = entityById.get(entityId);
        return entity
          ? [
              {
                id: entity.id,
                name: entity.name,
                state: entity.state,
                relationship: entity.relationship,
                lifeStatus: entity.lifeStatus,
              },
            ]
          : [];
      }),
      beats: [
        ...parsedStoryIntents.map(({ intent, payload }) => ({
          type: intent.beatType as 'omen' | 'aftermath',
          title: payload.title,
          content: payload.content,
          createdAt: intent.createdAt.toISOString(),
        })),
        ...parsedTravelIntents.map(({ intent, payload }) => ({
          type: intent.beatType as 'travel_prelude' | 'travel_echo',
          title: payload.title,
          content: [payload.content, payload.selectedOutcome]
            .filter(Boolean)
            .join('\n\n'),
          createdAt: intent.createdAt.toISOString(),
        })),
      ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      linkedRun: linkedRun
        ? {
            id: linkedRun.id,
            status: linkedRun.status,
            currentRound: linkedRun.currentRound,
            maxRounds: linkedRun.maxRounds,
          }
        : undefined,
      createdAt: thread.createdAt.toISOString(),
      resolvedAt: thread.resolvedAt?.toISOString(),
    };
  });

  const currentPersonal =
    entries.find(
      (entry) =>
        entry.id === activeThreadId && entry.threadScope === 'personal',
    ) ?? null;
  const currentSect =
    entries.find(
      (entry) =>
        entry.id === activeSectThreadId && entry.threadScope === 'sect',
    ) ?? null;
  return StoryArchiveResponseSchema.parse({
    current: currentPersonal ?? currentSect,
    currentPersonal,
    currentSect,
    history: entries.filter(
      (entry) =>
        entry.id !== currentPersonal?.id && entry.id !== currentSect?.id,
    ),
    total: totalRows[0]?.value ?? entries.length,
  });
}

export async function loadStoryProjectionState(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
  scope: 'personal' | 'sect' = 'personal',
): Promise<{
  state: typeof storyStates.$inferSelect | null;
  thread: typeof storyThreads.$inferSelect | null;
  entity: typeof storyEntities.$inferSelect | null;
}> {
  const [state] = await q
    .select()
    .from(storyStates)
    .where(eq(storyStates.cultivatorId, cultivatorId))
    .limit(1);
  const activeThreadId =
    scope === 'personal' ? state?.activeThreadId : state?.activeSectThreadId;
  if (!activeThreadId) {
    return { state: state ?? null, thread: null, entity: null };
  }

  const [thread] = await q
    .select()
    .from(storyThreads)
    .where(
      and(
        eq(storyThreads.id, activeThreadId),
        eq(storyThreads.cultivatorId, cultivatorId),
        eq(storyThreads.threadScope, scope),
      ),
    )
    .limit(1);
  if (!thread) return { state, thread: null, entity: null };

  const entityId = thread.entityIds[0];
  const [entity] = entityId
    ? await q
        .select()
        .from(storyEntities)
        .where(
          and(
            eq(storyEntities.id, entityId),
            eq(storyEntities.cultivatorId, cultivatorId),
          ),
        )
        .limit(1)
    : [];
  return { state, thread, entity: entity ?? null };
}

export function toThreadGenerationContext(input: {
  thread: typeof storyThreads.$inferSelect;
  entity: typeof storyEntities.$inferSelect | null;
}): StoryThreadGenerationContext {
  return {
    id: input.thread.id,
    threadScope: input.thread.threadScope,
    premise: input.thread.premise,
    unresolvedQuestion: input.thread.unresolvedQuestion,
    selectedChoiceKey: input.thread.selectedChoiceKey
      ? StoryChoiceKeySchema.parse(input.thread.selectedChoiceKey)
      : undefined,
    entity: input.entity
      ? {
          id: input.entity.id,
          name: input.entity.name,
          state: input.entity.state,
          relationship: input.entity.relationship,
          lifeStatus: input.entity.lifeStatus,
        }
      : undefined,
  };
}

export async function loadOwnedStoryIntent(
  cultivatorId: string,
  intentId: string,
  q: DbExecutor = getExecutor(),
) {
  const [row] = await q
    .select({
      intent: storyIntents,
      thread: storyThreads,
      cultivatorName: cultivators.name,
      cultivatorRealm: cultivators.realm,
      cultivatorRealmStage: cultivators.realm_stage,
      cultivatorPersonality: cultivators.personality,
      cultivatorBackground: cultivators.background,
    })
    .from(storyIntents)
    .innerJoin(storyThreads, eq(storyThreads.id, storyIntents.threadId))
    .innerJoin(cultivators, eq(cultivators.id, storyIntents.cultivatorId))
    .where(
      and(
        eq(storyIntents.id, intentId),
        eq(storyIntents.cultivatorId, cultivatorId),
        eq(storyThreads.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const payload = StoryIntentPayloadSchema.parse(row.intent.payload);
  const memories =
    payload.memoryRefs.length > 0
      ? await q
          .select({
            id: storyMemories.id,
            summary: storyMemories.summary,
            tags: storyMemories.tags,
            importance: storyMemories.importance,
            entityIds: storyMemories.entityIds,
            evidence: storyMemories.evidence,
          })
          .from(storyMemories)
          .where(
            and(
              eq(storyMemories.cultivatorId, cultivatorId),
              inArray(storyMemories.id, payload.memoryRefs),
            ),
          )
      : [];
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
  const orderedMemories = payload.memoryRefs.flatMap((id) => {
    const memory = memoryById.get(id);
    return memory ? [memory] : [];
  });
  const entityId = row.thread.entityIds[0];
  const [entity] = entityId
    ? await q
        .select()
        .from(storyEntities)
        .where(
          and(
            eq(storyEntities.id, entityId),
            eq(storyEntities.cultivatorId, cultivatorId),
          ),
        )
        .limit(1)
    : [];

  return {
    ...row,
    payload,
    memories: orderedMemories,
    entity: entity ?? null,
  };
}

export function toStoryMailDescriptor(input: {
  intent: typeof storyIntents.$inferSelect;
  thread: typeof storyThreads.$inferSelect;
  payload: ReturnType<typeof StoryIntentPayloadSchema.parse>;
}): StoryMailDescriptor {
  return StoryMailDescriptorSchema.parse({
    intentId: input.intent.id,
    threadId: input.thread.id,
    frameworkId: PERSONAL_STORY_FRAMEWORK_ID,
    frameworkTitle: PERSONAL_STORY_FRAMEWORK_TITLE,
    beatType: input.intent.beatType as StoryMailDescriptor['beatType'],
    status: input.intent.status as StoryMailDescriptor['status'],
    threadStatus: input.thread.status,
    choices: input.payload.choices,
    selectedChoiceKey: input.payload.selectedChoiceKey,
    canStartDungeon:
      input.thread.status === 'active' &&
      input.thread.stage === 'confrontation' &&
      Boolean(input.thread.linkedMapNodeId) &&
      !input.thread.linkedRunId &&
      Boolean(input.payload.dungeonBlueprint),
    awaitingTravelPrelude:
      input.thread.status === 'active' &&
      input.thread.stage === 'travel_prelude',
    linkedMapNodeId: input.thread.linkedMapNodeId ?? undefined,
  });
}

export async function listStoryMailDescriptors(
  cultivatorId: string,
  mailIds: string[],
  q: DbExecutor = getExecutor(),
): Promise<Map<string, StoryMailDescriptor>> {
  if (mailIds.length === 0) return new Map();

  const rows = await q
    .select({
      mailId: storyIntents.mailId,
      intentId: storyIntents.id,
      threadId: storyIntents.threadId,
      beatType: storyIntents.beatType,
      intentStatus: storyIntents.status,
      payload: storyIntents.payload,
      threadStage: storyThreads.stage,
      threadStatus: storyThreads.status,
      linkedMapNodeId: storyThreads.linkedMapNodeId,
      linkedRunId: storyThreads.linkedRunId,
    })
    .from(storyIntents)
    .innerJoin(storyThreads, eq(storyThreads.id, storyIntents.threadId))
    .where(
      and(
        eq(storyIntents.cultivatorId, cultivatorId),
        eq(storyThreads.cultivatorId, cultivatorId),
        inArray(storyIntents.mailId, mailIds),
      ),
    );

  return new Map(
    rows.flatMap((row) => {
      if (!row.mailId) return [];
      const payload = StoryIntentPayloadSchema.parse(row.payload);
      return [
        [
          row.mailId,
          StoryMailDescriptorSchema.parse({
            intentId: row.intentId,
            threadId: row.threadId,
            frameworkId: PERSONAL_STORY_FRAMEWORK_ID,
            frameworkTitle: PERSONAL_STORY_FRAMEWORK_TITLE,
            beatType: row.beatType as StoryMailDescriptor['beatType'],
            status: row.intentStatus as StoryMailDescriptor['status'],
            threadStatus: row.threadStatus,
            choices: payload.choices,
            selectedChoiceKey: payload.selectedChoiceKey,
            canStartDungeon:
              row.threadStatus === 'active' &&
              row.threadStage === 'confrontation' &&
              Boolean(row.linkedMapNodeId) &&
              !row.linkedRunId &&
              row.beatType === 'omen' &&
              Boolean(payload.dungeonBlueprint),
            awaitingTravelPrelude:
              row.threadStatus === 'active' &&
              row.threadStage === 'travel_prelude',
            linkedMapNodeId: row.linkedMapNodeId ?? undefined,
          }),
        ],
      ];
    }),
  );
}
