import {
  storyIntents,
  storyMemories,
  storyStates,
  storyThreads,
} from '@server/lib/drizzle/schema';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { executeDungeonCommand } from '@server/lib/services/DungeonApplicationService';
import { resourceEngine } from '@server/lib/services/resource/ResourceEngine';
import { resolveActivityStoryDecision } from '@server/lib/story/ActivityStoryDirector';
import { PERSONAL_STORY_COOLDOWN_MS } from '@server/lib/story/constants';
import {
  loadOwnedTravelStoryIntent,
  loadPendingTravelStoryEvent,
  toTravelStoryEvent,
} from '@server/lib/story/PersonalStoryRepository';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type { ResourceOperationSettlement } from '@shared/engine/resource/types';
import { selectActivityStoryDungeonNode } from '@shared/lib/game/mapSystem';
import {
  DungeonStoryContextSchema,
  StoryThreadLinkageContextSchema,
} from '@shared/lib/story/personalStory';
import {
  TravelStoryChoiceKeySchema,
  TravelStoryIntentPayloadSchema,
  calculateTravelStoryReward,
  isActivityStoryRewardWithinBudget,
  travelStoryMainlineDangerAdjustment,
  type TravelStoryChoiceKey,
  type TravelStoryDungeonBlueprint,
} from '@shared/lib/story/travelStory';
import { and, eq, inArray } from 'drizzle-orm';

export class TravelStoryCommandError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503,
  ) {
    super(message);
    this.name = 'TravelStoryCommandError';
  }
}

function rewardResourceChanges(
  settlement: ResourceOperationSettlement,
): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [];
  if (settlement.spiritStones !== undefined) {
    changes.push({
      resourceTopic: 'player.currency',
      eventType: 'currency.travel-story.rewarded',
      operation: 'merge',
      payload: { spiritStones: settlement.spiritStones },
    });
  }
  if (settlement.cultivationProgress) {
    changes.push({
      resourceTopic: 'player.progress',
      eventType: 'progress.travel-story.rewarded',
      operation: 'replace',
      payload: settlement.cultivationProgress,
    });
  }
  return changes;
}

function appendCanonSummary(current: string, addition: string): string {
  return [current.trim(), addition.trim()]
    .filter(Boolean)
    .join('\n')
    .slice(-4_000);
}

function fallbackActivityDungeonBlueprint(input: {
  title: string;
  content: string;
  outcome: string;
  choiceKey: TravelStoryChoiceKey;
}): TravelStoryDungeonBlueprint {
  const cautious = input.choiceKey === 'approach_carefully';
  return {
    title: `${input.title.slice(0, 48)}·深入`,
    theme: input.content.slice(0, 160),
    objective: cautious
      ? '循已确认的线索深入秘境，查明异闻源头并处理阻路威胁。'
      : '趁线索尚未消退直追异闻源头，并解决阻断调查的威胁。',
    openingHook: input.outcome.slice(0, 300),
    primaryClue: `${input.title.slice(0, 48)}留下的异常痕迹`,
    dangerTone: cautious ? 'cautious' : 'urgent',
  };
}

function appendBoundedStoryText(
  text: string,
  suffix: string,
  maxLength: number,
): string {
  return `${text.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
}

export function getPendingTravelStoryEvent(cultivatorId: string) {
  return loadPendingTravelStoryEvent(cultivatorId);
}

export async function chooseTravelStoryEvent(input: {
  userId: string;
  cultivatorId: string;
  intentId: string;
  choiceKey: TravelStoryChoiceKey;
}) {
  const selected = TravelStoryChoiceKeySchema.parse(input.choiceKey);
  const current = await loadOwnedTravelStoryIntent(
    input.cultivatorId,
    input.intentId,
  );
  if (!current) {
    throw new TravelStoryCommandError('途中异闻不存在', 404);
  }
  if (current.intent.availableAt > new Date()) {
    throw new TravelStoryCommandError('这段回响尚未到显现之时', 409);
  }
  if (
    current.intent.status === 'resolved' &&
    current.payload.selectedChoiceKey !== selected
  ) {
    throw new TravelStoryCommandError('这段异闻已经做出选择，不能更改', 409);
  }
  if (
    current.payload.selectedChoiceKey &&
    current.payload.selectedChoiceKey !== selected
  ) {
    throw new TravelStoryCommandError('这段异闻已经做出选择，不能更改', 409);
  }
  if (!current.payload.choices.some((choice) => choice.key === selected)) {
    throw new TravelStoryCommandError('该云游选择不可用', 400);
  }

  const committed = await playerCommandExecutor.executeWithLock({
    userId: input.userId,
    cultivatorId: input.cultivatorId,
    source: 'travel_story_choice',
    idempotency: {
      key: `${input.intentId}:${selected}`,
      fingerprint: `${input.intentId}:${selected}`,
    },
    allowEmpty: true,
    command: async (tx) => {
      const locked = await loadOwnedTravelStoryIntent(
        input.cultivatorId,
        input.intentId,
        tx,
        true,
      );
      if (!locked) {
        throw new TravelStoryCommandError('途中异闻不存在', 404);
      }
      if (locked.intent.availableAt > new Date()) {
        throw new TravelStoryCommandError('这段回响尚未到显现之时', 409);
      }
      if (locked.intent.status === 'resolved') {
        if (locked.payload.selectedChoiceKey !== selected) {
          throw new TravelStoryCommandError(
            '这段异闻已经做出选择，不能更改',
            409,
          );
        }
        return {
          result: {
            event: toTravelStoryEvent(locked),
            reward: locked.payload.selectedReward,
          },
          resourceChanges: [],
        };
      }
      if (locked.payload.selectedChoiceKey) {
        if (locked.payload.selectedChoiceKey !== selected) {
          throw new TravelStoryCommandError(
            '这段异闻已经做出选择，不能更改',
            409,
          );
        }
        return {
          result: {
            event: toTravelStoryEvent(locked),
            reward: locked.payload.selectedReward,
          },
          resourceChanges: [],
        };
      }
      if (!['ready', 'delivered'].includes(locked.intent.status)) {
        throw new TravelStoryCommandError('当前异闻状态无法做出选择', 409);
      }

      const choice = locked.payload.choices.find(
        (candidate) => candidate.key === selected,
      );
      if (!choice) {
        throw new TravelStoryCommandError('该云游选择不可用', 400);
      }
      const shouldOpenLinkedDungeon =
        locked.payload.source.activityType === 'travel' &&
        !locked.payload.linkage;
      if (shouldOpenLinkedDungeon) {
        const mapNode = selectActivityStoryDungeonNode(
          locked.payload.source.realm,
          locked.intent.id,
        );
        if (!mapNode) {
          throw new TravelStoryCommandError(
            '当前境界没有可承载异闻的秘境',
            503,
          );
        }
        const routeOutcome = choice.dungeonBlueprint
          ? choice.outcome
          : `${choice.outcome}\n\n正当你准备离开时，残痕在【${mapNode.name}】方向重新显现，露出一处仍可深入的秘境入口。`;
        const generatedBlueprint =
          choice.dungeonBlueprint ??
          fallbackActivityDungeonBlueprint({
            title: locked.payload.title,
            content: locked.payload.content,
            outcome: routeOutcome,
            choiceKey: selected,
          });
        const locationTheme = `；异闻入口最终通向【${mapNode.name}】。`;
        const locationHook = `你循已确认的入口抵达【${mapNode.name}】。`;
        const blueprint = {
          ...generatedBlueprint,
          theme: appendBoundedStoryText(
            generatedBlueprint.theme,
            locationTheme,
            160,
          ),
          openingHook: appendBoundedStoryText(
            generatedBlueprint.openingHook,
            locationHook,
            300,
          ),
        } satisfies TravelStoryDungeonBlueprint;
        const payload = TravelStoryIntentPayloadSchema.parse({
          ...locked.payload,
          selectedChoiceKey: selected,
          selectedOutcome: routeOutcome,
          linkedDungeon: {
            status: 'ready',
            mapNodeId: mapNode.id,
            blueprint,
          },
        });
        const [updatedIntent] = await tx
          .update(storyIntents)
          .set({
            payload,
            requiresChoice: false,
          })
          .where(
            and(
              eq(storyIntents.id, locked.intent.id),
              eq(storyIntents.cultivatorId, input.cultivatorId),
              inArray(storyIntents.status, ['ready', 'delivered']),
            ),
          )
          .returning();
        if (!updatedIntent) {
          throw new TravelStoryCommandError('异闻秘境路线保存失败', 503);
        }
        return {
          result: {
            event: toTravelStoryEvent({ intent: updatedIntent, payload }),
            reward: undefined,
          },
          resourceChanges: [],
        };
      }
      const reward = calculateTravelStoryReward({
        realm: locked.payload.source.realm,
        realmStage: locked.payload.source.realmStage,
        hours: locked.payload.source.hours,
        rewardKind: choice.rewardKind,
        activityType: locked.payload.source.activityType,
      });
      if (
        !isActivityStoryRewardWithinBudget({
          realm: locked.payload.source.realm,
          realmStage: locked.payload.source.realmStage,
          hours: locked.payload.source.hours,
          activityType: locked.payload.source.activityType,
          reward,
        })
      ) {
        throw new TravelStoryCommandError('活动剧情奖励超出服务端预算', 503);
      }
      const rewardResult = await resourceEngine.applyInTransaction({
        userId: input.userId,
        cultivatorId: input.cultivatorId,
        gain: [reward],
        tx,
      });
      if (!rewardResult.success || !rewardResult.settlement) {
        throw new TravelStoryCommandError(
          rewardResult.errors?.join('；') || '云游奖励发放失败',
          503,
        );
      }

      const payload = TravelStoryIntentPayloadSchema.parse({
        ...locked.payload,
        selectedChoiceKey: selected,
        selectedOutcome: choice.outcome,
        selectedReward: reward,
      });
      const occurredAt = new Date();
      await tx
        .insert(storyMemories)
        .values({
          cultivatorId: input.cultivatorId,
          sourceType: locked.payload.linkage ? 'story_thread' : 'travel_event',
          sourceId: locked.intent.id,
          factFingerprint: `travel-event:${locked.intent.id}`,
          summary: choice.memorySummary,
          tags: choice.tags,
          entityIds: locked.payload.entityRefs,
          importance: locked.payload.linkage
            ? locked.payload.linkage.kind === 'mainline_echo'
              ? 4
              : 3
            : 2,
          evidence: {
            intentId: locked.intent.id,
            actionInstanceId: locked.payload.source.actionInstanceId,
            activityType: locked.payload.source.activityType,
            activityId: locked.payload.source.activityId,
            rootActivityId: locked.payload.source.rootActivityId,
            choiceKey: selected,
            reward,
            linkage: locked.payload.linkage,
          },
          occurredAt,
        })
        .onConflictDoNothing();

      if (locked.payload.linkage) {
        const [thread] = await tx
          .select()
          .from(storyThreads)
          .where(
            and(
              eq(storyThreads.id, locked.payload.linkage.threadId),
              eq(storyThreads.cultivatorId, input.cultivatorId),
            ),
          )
          .for('update')
          .limit(1);
        if (!thread || thread.status !== 'active') {
          throw new TravelStoryCommandError('对应的主线已经失效', 409);
        }
        const linkageContext = StoryThreadLinkageContextSchema.parse(
          thread.linkageContext,
        );
        if (locked.payload.linkage.kind === 'mainline_prelude') {
          if (thread.stage !== 'travel_prelude') {
            throw new TravelStoryCommandError('主线已不在途中追查阶段', 409);
          }
          const dangerAdjustment =
            travelStoryMainlineDangerAdjustment(selected);
          const [advanced] = await tx
            .update(storyThreads)
            .set({
              stage: 'confrontation',
              linkageContext: StoryThreadLinkageContextSchema.parse({
                ...linkageContext,
                prelude: {
                  intentId: locked.intent.id,
                  choiceKey: selected,
                  outcome: choice.outcome,
                  dangerAdjustment,
                },
              }),
              version: thread.version + 1,
            })
            .where(
              and(
                eq(storyThreads.id, thread.id),
                eq(storyThreads.stage, 'travel_prelude'),
                eq(storyThreads.status, 'active'),
              ),
            )
            .returning({ id: storyThreads.id });
          if (!advanced) {
            throw new TravelStoryCommandError('主线推进失败，请刷新', 409);
          }
        } else {
          if (thread.stage !== 'aftermath') {
            throw new TravelStoryCommandError('主线尚未进入回响阶段', 409);
          }
          const [state] = await tx
            .select()
            .from(storyStates)
            .where(eq(storyStates.cultivatorId, input.cultivatorId))
            .for('update')
            .limit(1);
          if (!state || state.activeThreadId !== thread.id) {
            throw new TravelStoryCommandError('对应的主线状态已经失效', 409);
          }
          const [resolvedThread] = await tx
            .update(storyThreads)
            .set({
              stage: 'resolved',
              status: 'resolved',
              linkageContext,
              version: thread.version + 1,
              resolvedAt: occurredAt,
            })
            .where(
              and(
                eq(storyThreads.id, thread.id),
                eq(storyThreads.stage, 'aftermath'),
                eq(storyThreads.status, 'active'),
              ),
            )
            .returning({ id: storyThreads.id });
          if (!resolvedThread) {
            throw new TravelStoryCommandError('主线回响收束失败', 409);
          }
          await tx
            .update(storyStates)
            .set({
              activeThreadId: null,
              canonSummary: appendCanonSummary(
                state.canonSummary,
                [
                  linkageContext.dungeon?.summary,
                  choice.memorySummary,
                  thread.unresolvedQuestion,
                ]
                  .filter(Boolean)
                  .join(' '),
              ),
              cooldownUntil: new Date(
                occurredAt.getTime() + PERSONAL_STORY_COOLDOWN_MS,
              ),
              version: state.version + 1,
            })
            .where(eq(storyStates.cultivatorId, input.cultivatorId));
        }
      }
      const [updatedIntent] = await tx
        .update(storyIntents)
        .set({
          payload,
          requiresChoice: false,
          status: 'resolved',
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(storyIntents.id, locked.intent.id),
            eq(storyIntents.cultivatorId, input.cultivatorId),
            inArray(storyIntents.status, ['ready', 'delivered']),
          ),
        )
        .returning();
      if (!updatedIntent) {
        throw new TravelStoryCommandError('云游选择保存失败', 503);
      }
      if (locked.payload.director) {
        await resolveActivityStoryDecision({
          cultivatorId: input.cultivatorId,
          intentId: locked.intent.id,
          tx,
        });
      }

      return {
        result: {
          event: toTravelStoryEvent({ intent: updatedIntent, payload }),
          reward,
        },
        resourceChanges: rewardResourceChanges(rewardResult.settlement),
      };
    },
  });

  return {
    event: committed.result.event,
    reward: committed.result.reward,
    state: committed.state,
  };
}

export const getPendingActivityStory = getPendingTravelStoryEvent;
export const chooseActivityStory = chooseTravelStoryEvent;

export async function startActivityStoryDungeon(input: {
  userId: string;
  cultivatorId: string;
  intentId: string;
}) {
  const current = await loadOwnedTravelStoryIntent(
    input.cultivatorId,
    input.intentId,
  );
  if (!current) {
    throw new TravelStoryCommandError('途中异闻不存在', 404);
  }
  const dungeon = current.payload.linkedDungeon;
  const choiceKey = current.payload.selectedChoiceKey;
  const selectedOutcome = current.payload.selectedOutcome;
  if (
    current.payload.source.activityType !== 'travel' ||
    current.payload.linkage ||
    !dungeon ||
    dungeon.status !== 'ready' ||
    !choiceKey ||
    !selectedOutcome
  ) {
    throw new TravelStoryCommandError('当前异闻不能开启关联秘境', 409);
  }

  const cautious = choiceKey === 'approach_carefully';
  const rootActivityId =
    current.payload.director?.rootActivityId ??
    current.payload.source.rootActivityId ??
    `travel:${current.payload.source.actionInstanceId}`;
  const storyContext = DungeonStoryContextSchema.parse({
    sourceType: 'activity_story',
    activityIntentId: current.intent.id,
    rootActivityId,
    intentId: current.intent.id,
    frameworkId: 'activity_story',
    title: dungeon.blueprint.title,
    premise: dungeon.blueprint.theme,
    choiceKey,
    entryMode: cautious ? 'investigated' : 'direct',
    objective: dungeon.blueprint.objective,
    openingHook: dungeon.blueprint.openingHook,
    primaryClue: dungeon.blueprint.primaryClue,
    initialDangerAdjustment: cautious ? -5 : 5,
    entryAdvantage: cautious ? 'prepared_clue' : 'initiative',
    entryConsequence: cautious ? 'target_prepared' : 'higher_danger',
    travelChoiceKey: choiceKey,
    travelOutcome: selectedOutcome,
    travelDangerAdjustment: cautious ? -5 : 5,
    requiresBattle: true,
  });

  return executeDungeonCommand({
    userId: input.userId,
    cultivatorId: input.cultivatorId,
    command: {
      kind: 'start',
      mapNodeId: dungeon.mapNodeId,
      storyContext,
    },
  });
}
