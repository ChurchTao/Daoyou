import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  storyEntities,
  storyIntents,
  storyMemories,
  storyStates,
  storyThreads,
} from '@server/lib/drizzle/schema';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository';
import { MailService } from '@server/lib/services/MailService';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import {
  PERSONAL_STORY_FRAMEWORK_ID,
  PERSONAL_STORY_FRAMEWORK_VERSION,
  StoryIntentPayloadSchema,
  StoryThreadLinkageContextSchema,
  selectRelevantStoryMemories,
} from '@shared/lib/story/personalStory';
import { TravelStoryIntentPayloadSchema } from '@shared/lib/story/travelStory';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  materializeActivityStoryCandidate,
  recordMainlineActivityDecision,
} from './ActivityStoryDirector';
import {
  PERSONAL_STORY_CONSUMER_NAME,
  PERSONAL_STORY_LIVE_EVENT_MAX_AGE_MS,
  isNextPersonalStoryGenerationDue,
  isPersonalStoryEnabledForCultivator,
  personalStoryEchoDelayMs,
} from './constants';
import {
  deriveStoryAftermathPolicy,
  personalStoryGenerator,
} from './PersonalStoryGenerator';
import {
  findStoryMemoryByFingerprint,
  listRecentStoryMemories,
  listStoryEntitiesByIds,
  loadLatestDungeonStorySeed,
  loadStoryDungeonTriggerContext,
  loadStoryProjectionState,
  toThreadGenerationContext,
} from './PersonalStoryRepository';
import type {
  StoryAftermathGenerationResult,
  StoryAftermathPolicy,
  StoryDungeonTriggerContext,
  StoryMemoryReference,
  StoryOmenGenerationResult,
  TravelStoryGenerationResult,
  TravelStoryTriggerContext,
} from './types';

type ProjectionPlan =
  | { kind: 'memory_only' }
  | { kind: 'omen'; generation: StoryOmenGenerationResult }
  | {
      kind: 'activity_story';
      generation: TravelStoryGenerationResult;
      source: TravelStoryTriggerContext['journey'];
    }
  | {
      kind: 'aftermath';
      generation: StoryAftermathGenerationResult;
      policy: StoryAftermathPolicy;
      echo: {
        intentId: string;
        generation: TravelStoryGenerationResult;
        source: TravelStoryTriggerContext['journey'];
      };
    };

function dungeonMemoryFingerprint(runId: string): string {
  return `dungeon-run:${runId}`;
}

function readDungeonOutcome(
  evidence: Record<string, unknown>,
): StoryDungeonTriggerContext['run']['outcome'] | null {
  const outcome = evidence.outcome;
  return outcome === 'completed' ||
    outcome === 'retreated_after_battle' ||
    outcome === 'abandoned_before_battle'
    ? outcome
    : null;
}

async function lockStoryState(cultivatorId: string, tx: DbTransaction) {
  await tx.insert(storyStates).values({ cultivatorId }).onConflictDoNothing();
  const [state] = await tx
    .select()
    .from(storyStates)
    .where(eq(storyStates.cultivatorId, cultivatorId))
    .for('update')
    .limit(1);
  if (!state) throw new Error('个人剧情状态创建失败');
  return state;
}

async function insertOrLoadMemory(input: {
  planned: StoryMemoryReference;
  cultivatorId: string;
  runId: string;
  outcome: string;
  occurredAt: string;
  mapNodeId: string;
  generationSource: 'llm' | 'fallback';
  generationError?: string;
  tx: DbTransaction;
}): Promise<StoryMemoryReference> {
  await input.tx
    .insert(storyMemories)
    .values({
      id: input.planned.id,
      cultivatorId: input.cultivatorId,
      sourceType: 'dungeon_run',
      sourceId: input.runId,
      factFingerprint: dungeonMemoryFingerprint(input.runId),
      summary: input.planned.summary,
      tags: input.planned.tags,
      importance: input.planned.importance,
      evidence: {
        runId: input.runId,
        mapNodeId: input.mapNodeId,
        outcome: input.outcome,
        generationSource: input.generationSource,
        ...(input.generationError
          ? { generationError: input.generationError }
          : {}),
      },
      occurredAt: new Date(input.occurredAt),
    })
    .onConflictDoNothing();

  const memory = await findStoryMemoryByFingerprint(
    input.cultivatorId,
    dungeonMemoryFingerprint(input.runId),
    input.tx,
  );
  if (!memory) throw new Error('个人剧情记忆写入失败');
  return memory;
}

async function deliverOmen(input: {
  cultivatorId: string;
  mapNodeId: string;
  memory: StoryMemoryReference;
  plannedMemoryId: string;
  generation: StoryOmenGenerationResult;
  stateVersion: number;
  tx: DbTransaction;
}) {
  const output = input.generation.output;
  const [entity] = await input.tx
    .insert(storyEntities)
    .values({
      cultivatorId: input.cultivatorId,
      name: output.entity.name,
      entityType: output.entity.entityType,
      state: output.entity.state,
      relationship: output.entity.relationship,
    })
    .returning({ id: storyEntities.id });
  if (!entity) throw new Error('个人剧情实体创建失败');

  const [thread] = await input.tx
    .insert(storyThreads)
    .values({
      cultivatorId: input.cultivatorId,
      frameworkId: PERSONAL_STORY_FRAMEWORK_ID,
      frameworkVersion: PERSONAL_STORY_FRAMEWORK_VERSION,
      threadScope: 'personal',
      stage: 'choice',
      status: 'active',
      premise: output.premise,
      unresolvedQuestion: output.unresolvedQuestion,
      entityIds: [entity.id],
      linkedMapNodeId: input.mapNodeId,
    })
    .returning({ id: storyThreads.id });
  if (!thread) throw new Error('个人剧情线创建失败');

  const memoryRefs = output.memoryRefs.map((id) =>
    id === input.plannedMemoryId ? input.memory.id : id,
  );
  const payload = StoryIntentPayloadSchema.parse({
    title: output.title,
    content: output.content,
    memoryRefs,
    entityRefs: [entity.id],
    continuityClaims: output.continuityClaims,
    choices: output.choices,
    entityIntroductionMode: output.entity.introductionMode,
  });
  const [intent] = await input.tx
    .insert(storyIntents)
    .values({
      cultivatorId: input.cultivatorId,
      threadId: thread.id,
      storyVersion: PERSONAL_STORY_FRAMEWORK_VERSION,
      beatType: 'omen',
      payload,
      requiresChoice: true,
      status: 'ready',
      lastError: input.generation.error,
    })
    .returning({ id: storyIntents.id });
  if (!intent) throw new Error('个人剧情意图创建失败');

  const mail = await MailService.sendSystemMail(
    input.cultivatorId,
    output.title,
    output.content,
    input.tx,
  );
  await input.tx
    .update(storyIntents)
    .set({
      status: 'delivered',
      deliveredVia: 'mail',
      mailId: mail.id,
    })
    .where(eq(storyIntents.id, intent.id));
  await input.tx
    .update(storyStates)
    .set({
      activeThreadId: thread.id,
      version: input.stateVersion + 1,
    })
    .where(eq(storyStates.cultivatorId, input.cultivatorId));
  return mail;
}

async function deliverAftermath(input: {
  cultivatorId: string;
  memory: StoryMemoryReference;
  generation: StoryAftermathGenerationResult;
  thread: typeof storyThreads.$inferSelect;
  entity: typeof storyEntities.$inferSelect | null;
  policy: StoryAftermathPolicy;
  echo: Extract<ProjectionPlan, { kind: 'aftermath' }>['echo'];
  runId: string;
  occurredAt: string;
  tx: DbTransaction;
}) {
  const output = input.generation.output;
  const entityIds = input.entity ? [input.entity.id] : [];
  if (input.entity) {
    await input.tx
      .update(storyEntities)
      .set({
        state: input.policy.entityDefeated
          ? '在关联秘境中被玩家击败，死亡结果已确认'
          : output.entityState,
        relationship: input.policy.entityDefeated
          ? 'hostile'
          : output.relationship,
        lifeStatus: input.policy.lifeStatus,
        version: input.entity.version + 1,
      })
      .where(
        and(
          eq(storyEntities.id, input.entity.id),
          eq(storyEntities.cultivatorId, input.cultivatorId),
        ),
      );
  }

  await input.tx
    .insert(storyMemories)
    .values({
      cultivatorId: input.cultivatorId,
      sourceType: 'story_thread',
      sourceId: input.thread.id,
      factFingerprint: `story-thread:${input.thread.id}:aftermath`,
      summary: output.memorySummary,
      tags: Array.from(
        new Set([...input.memory.tags, '个人剧情', '前尘回响', '余波']),
      ),
      entityIds,
      importance: 4,
      evidence: {
        threadId: input.thread.id,
        dungeonMemoryId: input.memory.id,
        selectedChoiceKey: input.thread.selectedChoiceKey,
        generationSource: input.generation.source,
        narratorMode: input.policy.narratorMode,
        resolutionStatus: input.policy.resolutionStatus,
        entityLifeStatus: input.policy.lifeStatus,
        nextHook: output.nextHook,
      },
      occurredAt: new Date(input.occurredAt),
    })
    .onConflictDoNothing();

  const aftermathContent = `${output.content}\n\n此事尚有余音，待回响显现后再作最后回应。`;
  const payload = StoryIntentPayloadSchema.parse({
    title: output.title,
    content: aftermathContent,
    memoryRefs: [input.memory.id],
    entityRefs: entityIds,
    continuityClaims: output.continuityClaims,
    choices: [],
    resolutionStatus: input.policy.resolutionStatus,
    narratorMode: input.policy.narratorMode,
    nextHook: output.nextHook,
  });
  const [intent] = await input.tx
    .insert(storyIntents)
    .values({
      cultivatorId: input.cultivatorId,
      threadId: input.thread.id,
      storyVersion: PERSONAL_STORY_FRAMEWORK_VERSION,
      beatType: 'aftermath',
      payload,
      requiresChoice: false,
      status: 'ready',
      lastError: input.generation.error,
    })
    .onConflictDoNothing()
    .returning({ id: storyIntents.id });
  if (!intent) return null;

  const mail = await MailService.sendSystemMail(
    input.cultivatorId,
    output.title,
    aftermathContent,
    input.tx,
  );
  await input.tx
    .update(storyIntents)
    .set({ status: 'delivered', deliveredVia: 'mail', mailId: mail.id })
    .where(eq(storyIntents.id, intent.id));
  const availableAt = new Date(Date.now() + personalStoryEchoDelayMs());
  const echoPayload = TravelStoryIntentPayloadSchema.parse({
    kind: 'travel_event',
    ...input.echo.generation.output,
    source: input.echo.source,
    linkage: {
      kind: 'mainline_echo',
      threadId: input.thread.id,
      dungeonRunId: input.runId,
    },
  });
  const [echoIntent] = await input.tx
    .insert(storyIntents)
    .values({
      id: input.echo.intentId,
      cultivatorId: input.cultivatorId,
      threadId: input.thread.id,
      storyVersion: PERSONAL_STORY_FRAMEWORK_VERSION,
      beatType: 'travel_echo',
      sourceType: 'dungeon_settlement',
      sourceId: input.runId,
      payload: echoPayload,
      requiresChoice: true,
      status: 'ready',
      deliveredVia: 'home',
      availableAt,
      lastError: input.echo.generation.error,
    })
    .onConflictDoNothing()
    .returning({ id: storyIntents.id });
  if (!echoIntent) throw new Error('个人剧情延迟回响创建失败');

  const linkageContext = StoryThreadLinkageContextSchema.parse(
    input.thread.linkageContext,
  );
  const [advancedThread] = await input.tx
    .update(storyThreads)
    .set({
      stage: 'aftermath',
      status: 'active',
      unresolvedQuestion: output.nextHook,
      linkageContext: StoryThreadLinkageContextSchema.parse({
        ...linkageContext,
        dungeon: {
          runId: input.runId,
          outcome: input.policy.resolutionStatus,
          settledAt: input.occurredAt,
          summary: output.memorySummary,
        },
        echo: {
          intentId: echoIntent.id,
          availableAt: availableAt.toISOString(),
        },
      }),
      version: input.thread.version + 1,
    })
    .where(
      and(
        eq(storyThreads.id, input.thread.id),
        eq(storyThreads.cultivatorId, input.cultivatorId),
        eq(storyThreads.stage, 'confrontation'),
      ),
    )
    .returning({ id: storyThreads.id });
  if (!advancedThread) throw new Error('个人剧情无法进入延迟回响阶段');
  return mail;
}

export async function projectPersonalStoryDungeonEvent(
  event: DomainEventEnvelope,
): Promise<{ status: 'applied' | 'already_processed' | 'ignored' }> {
  if (!isDomainEventType(event, 'dungeon.run.settled')) {
    throw new Error(`个人剧情投影不支持领域事件: ${event.type}`);
  }
  if (!isPersonalStoryEnabledForCultivator(event.data.cultivatorId)) {
    return { status: 'ignored' };
  }

  const context = await loadStoryDungeonTriggerContext({
    cultivatorId: event.data.cultivatorId,
    runId: event.data.runId,
    outcome: event.data.outcome,
    occurredAt: event.occurredAt,
  });
  const eventAgeMs = Date.now() - new Date(event.occurredAt).getTime();
  const isLiveEvent =
    Number.isFinite(eventAgeMs) &&
    eventAgeMs >= 0 &&
    eventAgeMs <= PERSONAL_STORY_LIVE_EVENT_MAX_AGE_MS;
  const fingerprint = dungeonMemoryFingerprint(event.data.runId);
  const existingMemory = await findStoryMemoryByFingerprint(
    event.data.cultivatorId,
    fingerprint,
  );
  const memoryGeneration = existingMemory
    ? null
    : isLiveEvent
      ? await personalStoryGenerator.generateMemory(context)
      : personalStoryGenerator.generateMemoryFallback(context);
  const plannedMemory: StoryMemoryReference = existingMemory ?? {
    id: randomUUID(),
    summary: memoryGeneration!.output.summary,
    tags: memoryGeneration!.output.tags,
    importance: memoryGeneration!.output.importance,
    entityIds: [],
    evidence: {},
  };

  const projectionState = await loadStoryProjectionState(
    event.data.cultivatorId,
  );
  const previousMemories = await listRecentStoryMemories(
    event.data.cultivatorId,
    5,
  );
  const relevantMemories = selectRelevantStoryMemories(
    plannedMemory,
    previousMemories.filter((memory) => memory.id !== plannedMemory.id),
  );
  const relatedEntityIds = Array.from(
    new Set(relevantMemories.flatMap((memory) => memory.entityIds)),
  );
  const relatedEntities = await listStoryEntitiesByIds(
    event.data.cultivatorId,
    relatedEntityIds,
  );
  let plan: ProjectionPlan = { kind: 'memory_only' };

  if (
    projectionState.thread?.linkedRunId === event.data.runId &&
    projectionState.thread.stage === 'confrontation'
  ) {
    const threadContext = toThreadGenerationContext({
      thread: projectionState.thread,
      entity: projectionState.entity,
    });
    const policy = deriveStoryAftermathPolicy(context, threadContext);
    const aftermathGeneration = await personalStoryGenerator.generateAftermath({
      context,
      memory: plannedMemory,
      thread: threadContext,
    });
    const echoIntentId = randomUUID();
    const echoSource = {
      actionInstanceId: echoIntentId,
      hours: Math.min(24, Math.max(4, context.run.history.length)),
      realm: context.cultivator.realm as RealmType,
      realmStage: context.cultivator.realmStage as RealmStage,
      activityType: 'dungeon' as const,
      activityId: `dungeon:${event.data.runId}`,
      rootActivityId: `dungeon:${event.data.runId}`,
      title: context.run.theme.slice(0, 100),
      summary: (
        context.run.endingNarrative ??
        `${context.run.theme}已按${event.data.outcome}完成结算。`
      ).slice(0, 500),
    };
    plan = {
      kind: 'aftermath',
      policy,
      generation: aftermathGeneration,
      echo: {
        intentId: echoIntentId,
        source: echoSource,
        generation: await personalStoryGenerator.generateTravelEvent({
          context: {
            cultivator: {
              ...context.cultivator,
              realm: echoSource.realm,
              realmStage: echoSource.realmStage,
            },
            journey: echoSource,
            occurredAt: event.occurredAt,
          },
          memories: [plannedMemory, ...relevantMemories].slice(0, 6),
          relatedEntities: projectionState.entity
            ? [
                {
                  id: projectionState.entity.id,
                  name: projectionState.entity.name,
                  state: aftermathGeneration.output.entityState,
                  relationship: aftermathGeneration.output.relationship,
                  lifeStatus: policy.lifeStatus,
                },
              ]
            : [],
          activeThread: threadContext,
          linkage: {
            kind: 'mainline_echo',
            thread: threadContext,
            authoritativeSummary: `${aftermathGeneration.output.memorySummary}；关联秘境结算为${event.data.outcome}。`,
            nextHook: aftermathGeneration.output.nextHook,
          },
        }),
      },
    };
  } else if (
    isLiveEvent &&
    !projectionState.thread &&
    event.data.outcome !== 'abandoned_before_battle' &&
    (!projectionState.state?.cooldownUntil ||
      projectionState.state.cooldownUntil <= new Date())
  ) {
    plan = {
      kind: 'omen',
      generation: await personalStoryGenerator.generateOmen({
        context,
        memory: plannedMemory,
        previousMemories: relevantMemories,
        canonSummary: relevantMemories
          .map((memory) =>
            [
              memory.summary,
              typeof memory.evidence.nextHook === 'string'
                ? memory.evidence.nextHook
                : '',
            ]
              .filter(Boolean)
              .join(' '),
          )
          .join('\n'),
        relatedEntities: relatedEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          state: entity.state,
          relationship: entity.relationship,
          lifeStatus: entity.lifeStatus,
        })),
      }),
    };
  } else if (isLiveEvent && event.data.outcome !== 'abandoned_before_battle') {
    const source: TravelStoryTriggerContext['journey'] = {
      actionInstanceId: event.id,
      hours: Math.min(24, Math.max(4, context.run.history.length)),
      realm: context.cultivator.realm as RealmType,
      realmStage: context.cultivator.realmStage as RealmStage,
      activityType: 'dungeon',
      activityId: `dungeon:${event.data.runId}`,
      rootActivityId: `dungeon:${event.data.runId}`,
      title: context.run.theme.slice(0, 100),
      summary: (
        context.run.endingNarrative ??
        `${context.run.theme}已按${event.data.outcome}完成结算。`
      ).slice(0, 500),
    };
    plan = {
      kind: 'activity_story',
      source,
      generation: await personalStoryGenerator.generateActivityStory({
        context: {
          cultivator: {
            ...context.cultivator,
            realm: source.realm,
            realmStage: source.realmStage,
          },
          journey: source,
          occurredAt: event.occurredAt,
        },
        memories: [plannedMemory, ...relevantMemories].slice(0, 6),
        relatedEntities: relatedEntities.map((entity) => ({
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
      }),
    };
  }

  let projectedMail: { id: string; domainEventId: string } | null | undefined;
  const status = await db.transaction(async (tx) => {
    const claimed = await claimMessageForConsumer(
      {
        consumerName: PERSONAL_STORY_CONSUMER_NAME,
        messageId: event.id,
        messageKey: event.type,
      },
      tx,
    );
    if (!claimed) return 'already_processed' as const;

    const state = await lockStoryState(event.data.cultivatorId, tx);
    const memory = await insertOrLoadMemory({
      planned: plannedMemory,
      cultivatorId: event.data.cultivatorId,
      runId: event.data.runId,
      outcome: event.data.outcome,
      occurredAt: event.occurredAt,
      mapNodeId: event.data.mapNodeId,
      generationSource: memoryGeneration?.source ?? 'llm',
      generationError: memoryGeneration?.error,
      tx,
    });

    const current = await loadStoryProjectionState(event.data.cultivatorId, tx);
    const currentThread = current.thread;
    if (
      plan.kind === 'aftermath' &&
      currentThread !== null &&
      currentThread.id === projectionState.thread?.id &&
      currentThread.linkedRunId === event.data.runId &&
      currentThread.stage === 'confrontation'
    ) {
      const director = await recordMainlineActivityDecision({
        cultivatorId: event.data.cultivatorId,
        rootActivityId: `dungeon:${event.data.runId}`,
        sourceEventId: event.id,
        decision: 'mainline_dungeon',
        threadScope: 'personal',
        tx,
      });
      if (director !== 'ignored') {
        projectedMail = await deliverAftermath({
          cultivatorId: event.data.cultivatorId,
          memory,
          generation: plan.generation,
          thread: currentThread,
          entity: current.entity,
          policy: plan.policy,
          echo: plan.echo,
          runId: event.data.runId,
          occurredAt: event.occurredAt,
          tx,
        });
      }
    } else if (
      plan.kind === 'omen' &&
      isLiveEvent &&
      !current.thread &&
      event.data.outcome !== 'abandoned_before_battle' &&
      (!state.cooldownUntil || state.cooldownUntil <= new Date())
    ) {
      const director = await recordMainlineActivityDecision({
        cultivatorId: event.data.cultivatorId,
        rootActivityId: `dungeon:${event.data.runId}`,
        sourceEventId: event.id,
        decision: 'mainline_omen',
        threadScope: 'personal',
        tx,
      });
      if (director !== 'ignored') {
        projectedMail = await deliverOmen({
          cultivatorId: event.data.cultivatorId,
          mapNodeId: event.data.mapNodeId,
          memory,
          plannedMemoryId: plannedMemory.id,
          generation: plan.generation,
          stateVersion: state.version,
          tx,
        });
      }
    } else if (plan.kind === 'activity_story') {
      const payload = TravelStoryIntentPayloadSchema.parse({
        kind: 'activity_story',
        ...plan.generation.output,
        source: plan.source,
      });
      await materializeActivityStoryCandidate({
        cultivatorId: event.data.cultivatorId,
        rootActivityId: `dungeon:${event.data.runId}`,
        sourceEventId: event.id,
        decision: 'dungeon_short',
        payload,
        storyVersion: PERSONAL_STORY_FRAMEWORK_VERSION,
        availableAt: new Date(Date.now() + 5_000),
        lastError: plan.generation.error,
        tx,
      });
    }
    return 'applied' as const;
  });

  if (projectedMail) {
    publishTransactionalMessageBestEffort(projectedMail.domainEventId, {
      source: 'personal_story_mail',
      cultivatorId: event.data.cultivatorId,
      mailId: projectedMail.id,
    });
  }
  return { status };
}

export async function generateDuePersonalStoryForCultivator(
  cultivatorId: string,
  now = new Date(),
): Promise<{
  status: 'generated' | 'not_due' | 'missing_seed' | 'disabled';
  source?: 'llm' | 'fallback';
}> {
  if (!isPersonalStoryEnabledForCultivator(cultivatorId)) {
    return { status: 'disabled' };
  }

  const projectionState = await loadStoryProjectionState(cultivatorId);
  if (
    !projectionState.state ||
    projectionState.thread ||
    !isNextPersonalStoryGenerationDue({
      activeThreadId: projectionState.state.activeThreadId,
      cooldownUntil: projectionState.state.cooldownUntil,
      now,
    })
  ) {
    return { status: 'not_due' };
  }

  const seed = await loadLatestDungeonStorySeed(cultivatorId);
  const outcome = seed ? readDungeonOutcome(seed.memory.evidence) : null;
  if (!seed || !outcome) return { status: 'missing_seed' };

  const context = await loadStoryDungeonTriggerContext({
    cultivatorId,
    runId: seed.runId,
    outcome,
    occurredAt: seed.occurredAt,
  });
  const previousMemories = await listRecentStoryMemories(cultivatorId, 5);
  const relevantMemories = selectRelevantStoryMemories(
    seed.memory,
    previousMemories.filter((memory) => memory.id !== seed.memory.id),
  );
  const relatedEntityIds = Array.from(
    new Set(relevantMemories.flatMap((memory) => memory.entityIds)),
  );
  const relatedEntities = await listStoryEntitiesByIds(
    cultivatorId,
    relatedEntityIds,
  );
  const generation = await personalStoryGenerator.generateOmen({
    context,
    memory: seed.memory,
    previousMemories: relevantMemories,
    canonSummary: relevantMemories
      .map((memory) =>
        [
          memory.summary,
          typeof memory.evidence.nextHook === 'string'
            ? memory.evidence.nextHook
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join('\n'),
    relatedEntities: relatedEntities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      state: entity.state,
      relationship: entity.relationship,
      lifeStatus: entity.lifeStatus,
    })),
  });

  let projectedMail: { id: string; domainEventId: string } | null | undefined;
  const generated = await db.transaction(async (tx) => {
    const state = await lockStoryState(cultivatorId, tx);
    const current = await loadStoryProjectionState(cultivatorId, tx);
    if (
      current.thread ||
      !isNextPersonalStoryGenerationDue({
        activeThreadId: state.activeThreadId,
        cooldownUntil: state.cooldownUntil,
        now: new Date(),
      })
    ) {
      return false;
    }

    projectedMail = await deliverOmen({
      cultivatorId,
      mapNodeId: context.run.mapNodeId,
      memory: seed.memory,
      plannedMemoryId: seed.memory.id,
      generation,
      stateVersion: state.version,
      tx,
    });
    return true;
  });

  if (!generated) return { status: 'not_due' };
  if (projectedMail) {
    publishTransactionalMessageBestEffort(projectedMail.domainEventId, {
      source: 'personal_story_mail',
      cultivatorId,
      mailId: projectedMail.id,
    });
  }
  return { status: 'generated', source: generation.source };
}
