import { runDbTasks, type DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivatorBeasts,
  cultivators,
  sectMemberships,
} from '@server/lib/drizzle/schema';
import {
  findCultivatorStory,
  insertCultivatorStory,
  updateCultivatorStory,
} from '@server/lib/repositories/storyRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { getGuideLesson } from '@shared/guide/catalog';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { storyReward } from '@shared/story/grants';
import {
  getStoryChapter,
  restingStoryProgress,
} from '@shared/story/catalog';
import {
  acknowledgeGuide,
  acknowledgePerformance,
  noteStoryFact,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
  type StoryResolution,
} from '@shared/story/resolve';
import {
  emptyStoryFacts,
  STORY_MARK_FACT_IDS,
  type StoryChapter,
  type StoryFactId,
  type StoryFacts,
  type StoryProgress,
  type StoryView,
} from '@shared/story/schema';
import { and, eq, sql } from 'drizzle-orm';
import { grantInventory } from './InventoryService';

const MAIN_STORY_ID = 'arrival';

type StoryMarkFact = (typeof STORY_MARK_FACT_IDS)[number];

function isStoryMarkFact(fact: StoryFactId): fact is StoryMarkFact {
  return (STORY_MARK_FACT_IDS as readonly string[]).includes(fact);
}

function sameProgress(left: StoryProgress, right: StoryProgress): boolean {
  return (
    left.beatId === right.beatId &&
    left.status === right.status &&
    left.acks.join('\n') === right.acks.join('\n') &&
    left.grants.join('\n') === right.grants.join('\n') &&
    left.marks.join('\n') === right.marks.join('\n')
  );
}

function storyChanges(
  cultivatorId: string,
  view: StoryView,
  effect: { items: boolean; spiritStones: boolean },
): ResourceChangeDescriptor[] {
  const scope = { kind: 'cultivator' as const, id: cultivatorId };
  const changes: ResourceChangeDescriptor[] = [
    {
      scope,
      resourceTopic: 'player.story',
      eventType: 'story.progress_changed',
      operation: 'replace',
      payload: view,
    },
  ];
  if (effect.items) {
    changes.push(
      {
        scope,
        resourceTopic: 'inventory.bag',
        eventType: 'inventory.story.granted',
        operation: 'invalidate',
      },
      {
        scope,
        resourceTopic: 'inventory.materials',
        eventType: 'inventory.story.granted',
        operation: 'invalidate',
      },
    );
  }
  if (effect.spiritStones) {
    changes.push({
      scope,
      resourceTopic: 'player.currency',
      eventType: 'currency.story.granted',
      operation: 'invalidate',
    });
  }
  return changes;
}

async function readStoryFacts(
  cultivatorId: string,
  tx: DbTransaction,
): Promise<StoryFacts> {
  const facts = emptyStoryFacts();
  const [beasts, memberships, rows] = await runDbTasks(tx, [
    () =>
      tx
        .select({ id: cultivatorBeasts.id })
        .from(cultivatorBeasts)
        .where(eq(cultivatorBeasts.cultivatorId, cultivatorId))
        .limit(1),
    () =>
      tx
        .select({ id: sectMemberships.id })
        .from(sectMemberships)
        .where(
          and(
            eq(sectMemberships.cultivatorId, cultivatorId),
            eq(sectMemberships.status, 'active'),
          ),
        )
        .limit(1),
    () =>
      tx
        .select({ stage: cultivators.realm_stage })
        .from(cultivators)
        .where(eq(cultivators.id, cultivatorId))
        .limit(1),
  ]);
  facts.starter_beast = beasts.length > 0;
  facts.sect_joined = memberships.length > 0;
  facts.breakthrough_available = rows[0]?.stage === '圆满';
  return facts;
}

async function applyRewards(
  cultivatorId: string,
  ids: readonly string[],
  tx: DbTransaction,
): Promise<{ items: boolean; spiritStones: boolean }> {
  const rewards = ids.map((id) => storyReward(id, cultivatorId));
  const items = rewards.flatMap((reward) => reward.items);
  const stones = rewards.reduce((sum, reward) => sum + reward.spiritStones, 0);
  if (items.length > 0) await grantInventory(cultivatorId, items, tx);
  if (stones <= 0) return { items: items.length > 0, spiritStones: false };
  const updated = await tx
    .update(cultivators)
    .set({
      spirit_stones: sql`${cultivators.spirit_stones} + ${stones}`,
    })
    .where(
      and(
        eq(cultivators.id, cultivatorId),
        sql`${cultivators.spirit_stones} <= ${2147483647 - stones}`,
      ),
    )
    .returning({ id: cultivators.id });
  if (!updated.length) throw new Error('灵石超过上限');
  return { items: items.length > 0, spiritStones: stones > 0 };
}

async function settle(
  cultivatorId: string,
  tx: DbTransaction,
  mutate: (
    chapter: StoryChapter,
    progress: StoryProgress,
    facts: StoryFacts,
  ) => StoryResolution,
): Promise<{
  view: StoryView;
  dirty: boolean;
  rewardIds: string[];
  effect: { items: boolean; spiritStones: boolean };
}> {
  const stored = await findCultivatorStory(
    cultivatorId,
    'main',
    MAIN_STORY_ID,
    tx,
  );
  const base = stored ?? restingStoryProgress();
  const chapter = getStoryChapter(base.storyId);
  const progress = rewindToUnwatchedPerformance(chapter, base);
  const facts = await readStoryFacts(cultivatorId, tx);
  const resolved = mutate(chapter, progress, facts);
  const effect =
    resolved.grants.length > 0
      ? await applyRewards(cultivatorId, resolved.grants, tx)
      : { items: false, spiritStones: false };
  const dirty = !stored || !sameProgress(stored, resolved.progress);
  if (dirty) {
    if (stored) await updateCultivatorStory(cultivatorId, resolved.progress, tx);
    else await insertCultivatorStory(cultivatorId, resolved.progress, tx);
  }
  return {
    view: presentStory(chapter, resolved.progress, facts),
    dirty,
    rewardIds: resolved.grants,
    effect,
  };
}

export const StoryService = {
  async read(cultivatorId: string, tx: DbTransaction): Promise<StoryView> {
    const stored =
      (await findCultivatorStory(cultivatorId, 'main', MAIN_STORY_ID, tx)) ??
      restingStoryProgress();
    const chapter = getStoryChapter(stored.storyId);
    const progress = rewindToUnwatchedPerformance(chapter, stored);
    return presentStory(chapter, progress, await readStoryFacts(cultivatorId, tx));
  },

  async completePerformance(
    cultivatorId: string,
    scriptId: string,
    outcome: string,
    tx: DbTransaction,
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      acknowledgePerformance(chapter, progress, facts, scriptId, outcome),
    );
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },

  async completeGuide(
    cultivatorId: string,
    lessonId: string,
    tx: DbTransaction,
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    if (!getGuideLesson(lessonId)) throw new Error('没有这场教学');
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      acknowledgeGuide(chapter, progress, facts, lessonId),
    );
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },

  async noteFact(
    cultivatorId: string,
    fact: StoryFactId,
    tx: DbTransaction,
  ): Promise<{
    view: StoryView;
    changes: ResourceChangeDescriptor[];
  } | null> {
    if (!isStoryMarkFact(fact)) return null;
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      noteStoryFact(chapter, progress, facts, fact),
    );
    if (!settled.dirty && settled.rewardIds.length === 0) return null;
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },

  async reconcile(
    cultivatorId: string,
    tx: DbTransaction,
  ): Promise<{
    view: StoryView;
    changes: ResourceChangeDescriptor[];
  } | null> {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      resolveStory(chapter, progress, facts),
    );
    if (!settled.dirty && settled.rewardIds.length === 0) return null;
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },
};
