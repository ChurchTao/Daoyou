import {
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  cultivatorBeasts,
  cultivatorEquipmentSlots,
  cultivators,
  retreatRecords,
  sectCombatStates,
  sectMemberships,
  sectTaskRecords,
} from '@server/lib/drizzle/schema.js';
import {
  insertCultivatorStory,
  listCultivatorStories,
  updateCultivatorStory,
} from '@server/lib/repositories/storyRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { getGuideLesson } from '@daoyou/game-content/guide/catalog';
import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import { performanceFlags } from '@daoyou/game-domain/performance';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import {
  storyReward,
  restingStoryProgress,
  acknowledgeBattle,
  acknowledgeGuide,
  acknowledgePerformance,
  noteStoryFact,
  openingStoryProgress,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
  type StoryResolution,
} from '@daoyou/game-rules/story';
import { storyGiftParts } from '@daoyou/game-content/story/gifts';
import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import { giveStarterBeast } from '@server/combat/application/starterBeastGift.js';
import {
  emptyStoryFacts,
  chapterUnlocks,
  storyFlags,
  STORY_MARK_FACT_IDS,
  type StoryBattleOutcome,
  type StoryChapter,
  type StoryFactId,
  type StoryFacts,
  type StoryProgress,
  type StoryView,
} from '@daoyou/game-domain/story';
import { and, count, eq, isNotNull, sql } from 'drizzle-orm';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { grantInventory } from '@server/inventory/operations.js';

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
  const [beasts, memberships, rows, weapons, dailies, retreats] = await runDbTasks(tx, [
    () =>
      tx
        .select({ id: cultivatorBeasts.id })
        .from(cultivatorBeasts)
        .where(eq(cultivatorBeasts.cultivatorId, cultivatorId))
        .limit(1),
    () =>
      tx
        .select({ id: sectMemberships.id, pathId: sectCombatStates.activePathId })
        .from(sectMemberships)
        .leftJoin(
          sectCombatStates,
          eq(sectCombatStates.membershipId, sectMemberships.id),
        )
        .where(
          and(
            eq(sectMemberships.cultivatorId, cultivatorId),
            eq(sectMemberships.status, 'active'),
          ),
        )
        .limit(1),
    () =>
      tx
        .select({ realm: cultivators.realm, stage: cultivators.realm_stage })
        .from(cultivators)
        .where(eq(cultivators.id, cultivatorId))
        .limit(1),
    () =>
      tx
        .select({ id: cultivatorEquipmentSlots.equipmentInstanceId })
        .from(cultivatorEquipmentSlots)
        .where(
          and(
            eq(cultivatorEquipmentSlots.cultivatorId, cultivatorId),
            eq(cultivatorEquipmentSlots.slot, 'weapon'),
          ),
        )
        .limit(1),
    // 历来交了差的宗门日常，换过宗门的也算。做完没交的不算。
    () =>
      tx
        .select({ value: count() })
        .from(sectTaskRecords)
        .innerJoin(
          sectMemberships,
          eq(sectMemberships.id, sectTaskRecords.membershipId),
        )
        .where(
          and(
            eq(sectMemberships.cultivatorId, cultivatorId),
            eq(sectTaskRecords.kind, 'daily'),
            isNotNull(sectTaskRecords.claimedAt),
          ),
        ),
    () =>
      tx
        .select({ value: count() })
        .from(retreatRecords)
        .where(eq(retreatRecords.cultivatorId, cultivatorId)),
  ]);
  facts.counts = {
    sect_dailies: Number(dailies[0]?.value ?? 0),
    retreats: Number(retreats[0]?.value ?? 0),
  };
  facts.starter_beast = beasts.length > 0;
  facts.sect_joined = memberships.length > 0;
  facts.sect_ready = Boolean(memberships[0]?.pathId);
  facts.weapon_equipped = weapons.length > 0;
  facts.breakthrough_available = rows[0]?.stage === '圆满';
  if (rows[0]) {
    facts.standing = {
      realm: rows[0].realm as RealmType,
      stage: rows[0].stage as RealmStage,
    };
  }
  return facts;
}

async function applyRewards(
  cultivatorId: string,
  ids: readonly string[],
  tx: DbTransaction,
): Promise<{ items: boolean; spiritStones: boolean }> {
  // 一份赠礼可以由几样拼成：掉落包里的东西，或者一只灵兽。
  const parts = ids.flatMap((id) => storyGiftParts(id));
  for (const part of parts) {
    if (part.type === 'beast')
      await giveStarterBeast(cultivatorId, part.species, tx);
  }
  const rewards = parts.flatMap((part) =>
    part.type === 'payout' ? [storyReward(part.payout, cultivatorId)] : [],
  );
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

// 主线眼下演到的那一章：还没演完的优先，否则取最近的一章。
async function currentStory(
  cultivatorId: string,
  tx: DbExecutor | DbTransaction,
) {
  const rows = await listCultivatorStories(cultivatorId, 'main', tx);
  const stored = rows.find((row) => row.status === 'active') ?? rows[0] ?? null;
  const past = rows.filter((row) => row !== stored);
  return {
    rows,
    stored,
    carried: past.flatMap((row) => storyFlags(row.marks)),
    opened: past.flatMap((row) => chapterUnlocks(getStoryChapter(row.storyId))),
  };
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
  const { rows, stored, carried, opened } = await currentStory(
    cultivatorId,
    tx,
  );
  const base = stored ?? restingStoryProgress();
  let chapter = getStoryChapter(base.storyId);
  const facts = await readStoryFacts(cultivatorId, tx);
  const progress = rewindToUnwatchedPerformance(chapter, base, facts);
  let resolved = mutate(chapter, progress, facts);
  const rewardIds = [...resolved.grants];
  let dirty = !stored || !sameProgress(stored, resolved.progress);
  if (dirty) {
    if (stored) await updateCultivatorStory(cultivatorId, resolved.progress, tx);
    else await insertCultivatorStory(cultivatorId, resolved.progress, tx);
  }

  // 一章演完就接下一章；下一章开头若已满足，也一并走过去。
  const flags = [...carried];
  const unlocks = [...opened];
  const visited = new Set([chapter.id]);
  while (resolved.finished && chapter.next && !visited.has(chapter.next)) {
    flags.push(...storyFlags(resolved.progress.marks));
    unlocks.push(...chapterUnlocks(chapter));
    chapter = getStoryChapter(chapter.next);
    visited.add(chapter.id);
    const resumed = rows.find((row) => row.storyId === chapter.id);
    resolved = resolveStory(
      chapter,
      resumed
        ? { ...resumed, status: 'active' }
        : openingStoryProgress(chapter.id),
      facts,
    );
    rewardIds.push(...resolved.grants);
    if (resumed) await updateCultivatorStory(cultivatorId, resolved.progress, tx);
    else await insertCultivatorStory(cultivatorId, resolved.progress, tx);
    dirty = true;
  }

  const effect =
    rewardIds.length > 0
      ? await applyRewards(cultivatorId, rewardIds, tx)
      : { items: false, spiritStones: false };
  return {
    view: presentStory(chapter, resolved.progress, facts, flags, unlocks),
    dirty,
    rewardIds,
    effect,
  };
}

export const StoryService = {
  /** 主线眼下开了哪些门。为空表示不设限。只读进度，不推进剧情。 */
  async unlocked(
    cultivatorId: string,
    q: DbExecutor | DbTransaction,
  ): Promise<string[] | null> {
    const { stored, opened } = await currentStory(cultivatorId, q);
    if (!stored) return null;
    const chapter = getStoryChapter(stored.storyId);
    if (!chapter.gated) return null;
    return [...new Set([...opened, ...chapterUnlocks(chapter, stored.beatId)])];
  },

  async read(cultivatorId: string, tx: DbTransaction): Promise<StoryView> {
    const { stored, carried, opened } = await currentStory(cultivatorId, tx);
    const base = stored ?? restingStoryProgress();
    const chapter = getStoryChapter(base.storyId);
    const facts = await readStoryFacts(cultivatorId, tx);
    const progress = rewindToUnwatchedPerformance(chapter, base, facts);
    return presentStory(chapter, progress, facts, carried, opened);
  },

  async completePerformance(
    cultivatorId: string,
    scriptId: string,
    outcome: string,
    chosen: readonly string[],
    tx: DbTransaction,
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const allowed = performanceFlags(getPerformanceScript(scriptId));
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      acknowledgePerformance(chapter, progress, facts, scriptId, outcome, {
        flags: chosen,
        allowed,
      }),
    );
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },

  /** 剧情战打完了，把结果记进主线。 */
  async completeBattle(
    cultivatorId: string,
    battleId: string,
    outcome: StoryBattleOutcome,
    tx: DbTransaction,
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      acknowledgeBattle(chapter, progress, facts, battleId, outcome),
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
    // 这件事已经记过就不必再算一遍；买东西、用丹这类事会反复发生。
    const { stored } = await currentStory(cultivatorId, tx);
    if (stored?.marks.includes(fact)) return null;
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
