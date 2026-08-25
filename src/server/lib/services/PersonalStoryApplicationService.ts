import { db, getExecutor } from '@server/lib/drizzle/db';
import { storyIntents, storyThreads } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { executeDungeonCommand } from '@server/lib/services/DungeonApplicationService';
import { personalStoryGenerator } from '@server/lib/story/PersonalStoryGenerator';
import {
  loadOwnedStoryIntent,
  toStoryMailDescriptor,
  toThreadGenerationContext,
} from '@server/lib/story/PersonalStoryRepository';
import {
  DungeonStoryContextSchema,
  StoryChoiceKeySchema,
  StoryIntentPayloadSchema,
  StoryThreadLinkageContextSchema,
  storyChoiceLaunchRules,
  type StoryChoiceKey,
} from '@shared/lib/story/personalStory';
import {
  TravelStoryIntentPayloadSchema,
  combineStoryDangerAdjustments,
} from '@shared/lib/story/travelStory';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export class PersonalStoryCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503,
  ) {
    super(message);
    this.name = 'PersonalStoryCommandError';
  }
}

export async function choosePersonalStory(input: {
  cultivatorId: string;
  intentId: string;
  choiceKey: StoryChoiceKey;
}) {
  const selected = StoryChoiceKeySchema.parse(input.choiceKey);
  const current = await loadOwnedStoryIntent(
    input.cultivatorId,
    input.intentId,
  );
  if (!current) {
    throw new PersonalStoryCommandError('剧情信件不存在', 404);
  }
  if (current.intent.beatType !== 'omen' || !current.intent.requiresChoice) {
    throw new PersonalStoryCommandError('这封信不需要作出选择', 409);
  }
  if (!current.payload.choices.some((choice) => choice.key === selected)) {
    throw new PersonalStoryCommandError('该剧情选择不可用', 400);
  }
  if (
    ['travel_prelude', 'confrontation', 'aftermath', 'resolved'].includes(
      current.thread.stage,
    ) ||
    current.thread.status === 'resolved'
  ) {
    if (current.payload.selectedChoiceKey !== selected) {
      throw new PersonalStoryCommandError('剧情选择已经确认，不能更改', 409);
    }
    return { story: toStoryMailDescriptor(current) };
  }
  if (current.thread.stage !== 'choice') {
    throw new PersonalStoryCommandError('剧情当前不在选择阶段', 409);
  }
  if (
    selected === 'delay' &&
    current.thread.status === 'paused' &&
    current.payload.selectedChoiceKey === 'delay'
  ) {
    return { story: toStoryMailDescriptor(current) };
  }

  const generation =
    selected === 'delay'
      ? null
      : await (async () => {
          const memory = current.memories[0];
          if (!memory) {
            throw new PersonalStoryCommandError('剧情引用的旧事已经失效', 409);
          }
          const preludeIntentId = randomUUID();
          const thread = toThreadGenerationContext({
            thread: {
              ...current.thread,
              selectedChoiceKey: selected,
            },
            entity: current.entity,
          });
          const source = {
            actionInstanceId: preludeIntentId,
            hours: 4,
            realm: current.cultivatorRealm as RealmType,
            realmStage: current.cultivatorRealmStage as RealmStage,
            activityType: 'travel' as const,
            activityId: `story-thread:${current.thread.id}:prelude`,
            rootActivityId: `story-thread:${current.thread.id}`,
            title: current.thread.premise.slice(0, 100),
            summary: `个人主线已进入途中追查阶段。`,
          };
          const [blueprint, travel] = await Promise.all([
            personalStoryGenerator.generateDungeonBlueprint({
              cultivatorName: current.cultivatorName,
              memory,
              thread,
              choiceKey: selected,
            }),
            personalStoryGenerator.generateTravelEvent({
              context: {
                cultivator: {
                  id: input.cultivatorId,
                  name: current.cultivatorName,
                  realm: source.realm,
                  realmStage: source.realmStage,
                  personality: current.cultivatorPersonality,
                  background: current.cultivatorBackground,
                },
                journey: source,
                occurredAt: new Date().toISOString(),
              },
              memories: current.memories,
              relatedEntities: current.entity
                ? [
                    {
                      id: current.entity.id,
                      name: current.entity.name,
                      state: current.entity.state,
                      relationship: current.entity.relationship,
                      lifeStatus: current.entity.lifeStatus,
                    },
                  ]
                : [],
              activeThread: thread,
              linkage: {
                kind: 'mainline_prelude',
                thread,
                authoritativeSummary: `${current.thread.premise}；玩家已选择${selected === 'intervene_now' ? '立即介入' : '先行调查'}。`,
              },
            }),
          ]);
          return {
            blueprint,
            travel,
            preludeIntentId,
            source,
          };
        })();

  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(input.cultivatorId),
      context: 'personal-story-choice',
      timeoutMs: 10_000,
      retries: 0,
    },
    async (lease) => {
      lease.assertHeld();
      return db.transaction(async (tx) => {
        const locked = await loadOwnedStoryIntent(
          input.cultivatorId,
          input.intentId,
          tx,
        );
        if (!locked || locked.thread.stage !== 'choice') {
          throw new PersonalStoryCommandError('剧情状态已经变化，请刷新', 409);
        }

        if (selected === 'delay') {
          const payload = StoryIntentPayloadSchema.parse({
            ...locked.payload,
            selectedChoiceKey: selected,
          });
          const [updatedThread] = await tx
            .update(storyThreads)
            .set({
              status: 'paused',
              selectedChoiceKey: selected,
              version: locked.thread.version + 1,
            })
            .where(
              and(
                eq(storyThreads.id, locked.thread.id),
                eq(storyThreads.cultivatorId, input.cultivatorId),
                eq(storyThreads.stage, 'choice'),
              ),
            )
            .returning();
          if (!updatedThread) {
            throw new PersonalStoryCommandError(
              '剧情状态已经变化，请刷新',
              409,
            );
          }
          await tx
            .update(storyIntents)
            .set({ payload })
            .where(
              and(
                eq(storyIntents.id, locked.intent.id),
                eq(storyIntents.cultivatorId, input.cultivatorId),
              ),
            );
          return {
            story: toStoryMailDescriptor({
              intent: { ...locked.intent, payload },
              thread: updatedThread,
              payload,
            }),
          };
        }

        if (!generation) {
          throw new PersonalStoryCommandError('关联秘境生成失败', 503);
        }
        const payload = StoryIntentPayloadSchema.parse({
          ...locked.payload,
          selectedChoiceKey: selected,
          dungeonBlueprint: generation.blueprint.output,
        });
        const [updatedThread] = await tx
          .update(storyThreads)
          .set({
            stage: 'travel_prelude',
            status: 'active',
            selectedChoiceKey: selected,
            version: locked.thread.version + 1,
          })
          .where(
            and(
              eq(storyThreads.id, locked.thread.id),
              eq(storyThreads.cultivatorId, input.cultivatorId),
              eq(storyThreads.stage, 'choice'),
            ),
          )
          .returning();
        if (!updatedThread) {
          throw new PersonalStoryCommandError('剧情状态已经变化，请刷新', 409);
        }
        const travelPayload = TravelStoryIntentPayloadSchema.parse({
          kind: 'travel_event',
          ...generation.travel.output,
          source: generation.source,
          linkage: {
            kind: 'mainline_prelude',
            threadId: locked.thread.id,
            anchorIntentId: locked.intent.id,
          },
        });
        const [preludeIntent] = await tx
          .insert(storyIntents)
          .values({
            id: generation.preludeIntentId,
            cultivatorId: input.cultivatorId,
            threadId: locked.thread.id,
            storyVersion: locked.thread.frameworkVersion,
            beatType: 'travel_prelude',
            sourceType: 'story_choice',
            sourceId: locked.intent.id,
            payload: travelPayload,
            requiresChoice: true,
            status: 'delivered',
            deliveredVia: 'home',
            lastError: generation.travel.error,
          })
          .onConflictDoNothing()
          .returning({ id: storyIntents.id });
        if (!preludeIntent) {
          throw new PersonalStoryCommandError('主线云游线索创建失败', 503);
        }
        const [updatedIntent] = await tx
          .update(storyIntents)
          .set({
            payload,
            status: 'resolved',
            resolvedAt: new Date(),
            lastError:
              [generation.blueprint.error, generation.travel.error]
                .filter(Boolean)
                .join('\n') || undefined,
          })
          .where(
            and(
              eq(storyIntents.id, locked.intent.id),
              eq(storyIntents.cultivatorId, input.cultivatorId),
            ),
          )
          .returning();
        if (!updatedIntent) {
          throw new PersonalStoryCommandError('剧情选择保存失败', 503);
        }
        return {
          story: toStoryMailDescriptor({
            intent: updatedIntent,
            thread: updatedThread,
            payload,
          }),
        };
      });
    },
  );
}

export async function startPersonalStoryDungeon(input: {
  userId: string;
  cultivatorId: string;
  intentId: string;
}) {
  const current = await loadOwnedStoryIntent(
    input.cultivatorId,
    input.intentId,
    getExecutor(),
  );
  if (!current) {
    throw new PersonalStoryCommandError('剧情信件不存在', 404);
  }
  if (
    current.thread.stage !== 'confrontation' ||
    current.thread.status !== 'active' ||
    current.thread.linkedRunId
  ) {
    throw new PersonalStoryCommandError('当前剧情不能再次开启关联秘境', 409);
  }
  const choiceKey = current.payload.selectedChoiceKey;
  const blueprint = current.payload.dungeonBlueprint;
  const mapNodeId = current.thread.linkedMapNodeId;
  if (!choiceKey || choiceKey === 'delay' || !blueprint || !mapNodeId) {
    throw new PersonalStoryCommandError('关联秘境尚未准备完成', 409);
  }
  const launchRules = storyChoiceLaunchRules(choiceKey);
  if (!launchRules.entryMode) {
    throw new PersonalStoryCommandError('请先确认如何处理这封信', 409);
  }

  const linkageContext = StoryThreadLinkageContextSchema.parse(
    current.thread.linkageContext,
  );
  const prelude = linkageContext.prelude ?? {
    intentId: current.intent.id,
    choiceKey:
      choiceKey === 'investigate_first'
        ? ('approach_carefully' as const)
        : ('act_decisively' as const),
    outcome: '此章节在主线云游联动上线前已确认进入方式，不追加途中危险修正。',
    dangerAdjustment: 0,
  };

  const storyContext = DungeonStoryContextSchema.parse({
    threadId: current.thread.id,
    intentId: current.intent.id,
    frameworkId: current.thread.frameworkId,
    title: blueprint.title,
    premise: current.thread.premise,
    choiceKey,
    entryMode: launchRules.entryMode,
    objective: blueprint.objective,
    openingHook: blueprint.openingHook,
    primaryClue: blueprint.primaryClue,
    initialDangerAdjustment: combineStoryDangerAdjustments(
      launchRules.initialDangerAdjustment,
      prelude.dangerAdjustment,
    ),
    entryAdvantage: launchRules.entryAdvantage,
    entryConsequence: launchRules.entryConsequence,
    travelChoiceKey: prelude.choiceKey,
    travelOutcome: prelude.outcome,
    travelDangerAdjustment: prelude.dangerAdjustment,
  });

  return executeDungeonCommand({
    userId: input.userId,
    cultivatorId: input.cultivatorId,
    command: { kind: 'start', mapNodeId, storyContext },
  });
}
