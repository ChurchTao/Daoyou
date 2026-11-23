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
import { readSectMethodLevels } from '@server/lib/repositories/sectCombatRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { updateCultivationExp } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { getGuideLesson } from '@daoyou/game-content/guide/catalog';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import {
  getPerformanceScript,
  MINE_ROAD_SCRIPT,
} from '@daoyou/game-content/performance/catalog';
import { performanceFlags } from '@daoyou/game-domain/performance';
import type { CompleteStoryPassage } from '@daoyou/contracts/story';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import {
  storyReward,
  restingStoryProgress,
  acknowledgeBattle,
  acknowledgeGuide,
  acknowledgePerformance,
  acknowledgeStoryPassage,
  noteForgedStoryWeapon,
  noteStoryFact,
  openingStoryProgress,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
  storyPassageMark,
  type StoryResolution,
} from '@daoyou/game-rules/story';
import { storyGiftParts } from '@daoyou/game-content/story/gifts';
import {
  getStoryChapter,
  OPENING_STORY_CHAPTER,
} from '@daoyou/game-content/story/catalog';
import {
  STORY_EXTRA_GATES,
  STORY_SCENE_GATES,
  storyChapterUnlocks,
} from '@daoyou/game-domain/story/gates';
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
type StoryRewardEffect = {
  items: boolean;
  spiritStones: boolean;
  cultivationExp: boolean;
};

function isStoryMarkFact(fact: StoryFactId): fact is StoryMarkFact {
  return (STORY_MARK_FACT_IDS as readonly string[]).includes(fact);
}

function sameProgress(left: StoryProgress, right: StoryProgress): boolean {
  return (
    left.storyId === right.storyId &&
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
  effect: StoryRewardEffect,
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
  if (effect.cultivationExp) {
    changes.push({
      scope,
      resourceTopic: 'player.progress',
      eventType: 'progress.story.granted',
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
        .select({
          id: sectMemberships.id,
          sectId: sectMemberships.sectId,
          pathId: sectCombatStates.activePathId,
        })
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
  const membership = memberships[0];
  facts.sect_joined = Boolean(membership);
  facts.sect_ready = Boolean(membership?.pathId);
  if (membership && Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, membership.sectId)) {
    const sect = COMBAT_V6_SECT_DEFINITIONS[
      membership.sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS
    ];
    const primary = sect.methods.find((method) => method.isPrimary);
    if (primary) {
      const levels = await readSectMethodLevels(membership.id, tx);
      facts.sect_primary_method_trained = (levels[primary.id] ?? 0) >= 2;
    }
  }
  facts.weapon_equipped = weapons.length > 0;
  facts.equippedWeaponId = weapons[0]?.id;
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
): Promise<StoryRewardEffect> {
  const parts = ids.flatMap((id) => storyGiftParts(id));
  for (const part of parts) {
    if (part.type === 'beast')
      await giveStarterBeast(cultivatorId, part.species, tx);
  }
  const rewards = parts.flatMap((part) =>
    part.type === 'payout' ? [storyReward(part.payout, cultivatorId)] : [],
  );
  const items = rewards.flatMap((reward) => reward.items);
  const resources = parts.filter((part) => part.type === 'resources');
  const stones =
    rewards.reduce((sum, reward) => sum + reward.spiritStones, 0) +
    resources.reduce((sum, part) => sum + part.spiritStones, 0);
  const cultivationExp = resources.reduce((sum, part) => sum + part.cultivationExp, 0);
  if (items.length > 0) await grantInventory(cultivatorId, items, tx);
  if (stones > 0) {
    const updated = await tx
      .update(cultivators)
      .set({ spirit_stones: sql`${cultivators.spirit_stones} + ${stones}` })
      .where(
        and(
          eq(cultivators.id, cultivatorId),
          sql`${cultivators.spirit_stones} <= ${2147483647 - stones}`,
        ),
      )
      .returning({ id: cultivators.id });
    if (!updated.length) throw new Error('灵石超过上限');
  }
  if (cultivationExp > 0) {
    const [character] = await tx
      .select({ userId: cultivators.userId })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId));
    if (!character) throw new Error('修真者不存在');
    await updateCultivationExp(character.userId, cultivatorId, cultivationExp, undefined, tx);
  }
  return { items: items.length > 0, spiritStones: stones > 0, cultivationExp: cultivationExp > 0 };
}

// 主线眼下演到的那一章：还没演完的优先，否则取最近的一章。
async function currentStory(
  cultivatorId: string,
  tx: DbExecutor | DbTransaction,
) {
  const history = await listCultivatorStories(cultivatorId, 'main', tx);
  // 旧主线的章幕与新版无对应关系。保留原记录，另记新版进度。
  const rows = history.filter(
    ({ storyId }) =>
      storyId !== 'arrival' &&
      !storyId.startsWith('v1-') &&
      !storyId.startsWith('mountain-'),
  );
  const returning = rows.length !== history.length;
  const stored = rows.find((row) => row.status === 'active') ?? rows[0] ?? null;
  const past = rows.filter((row) => row !== stored);
  const finishedGate = past.find(
    (row) =>
      row.storyId === 'mine-gate' && row.acks.includes('mine-gate-home:done'),
  );
  let base =
    stored ??
    (returning
      ? openingStoryProgress(OPENING_STORY_CHAPTER)
      : restingStoryProgress());
  if (stored?.storyId === 'mine-lodging' && finishedGate) {
    base = openingStoryProgress('mine-lesson');
  }
  if (stored?.storyId === 'mine-sparring' && stored.beatId === 'errand') {
    base = openingStoryProgress('mine-errand');
  }
  // 旧版读完第四章就开放了全部场景，已经走过的角色保留入口。
  const hadFullAccess =
    returning || (finishedGate && finishedGate.beatId !== 'settle-in');
  const carriedRows = rows.filter((row) => row.storyId !== base.storyId);
  return {
    rows,
    stored,
    base,
    carried: carriedRows.flatMap((row) => storyFlags(row.marks)),
    opened: hadFullAccess
      ? [
          ...new Set([
            ...Object.values(STORY_SCENE_GATES),
            ...STORY_EXTRA_GATES,
          ]),
        ]
      : past.flatMap((row) => chapterUnlocks(getStoryChapter(row.storyId))),
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
  effect: StoryRewardEffect;
}> {
  const { rows, stored, base, carried, opened } = await currentStory(
    cultivatorId,
    tx,
  );
  let chapter = getStoryChapter(base.storyId);
  const facts = await readStoryFacts(cultivatorId, tx);
  const progress = rewindToUnwatchedPerformance(chapter, base, facts);
  let resolved = mutate(chapter, progress, facts);
  const rewardIds = [...resolved.grants];
  let dirty = !stored || !sameProgress(stored, resolved.progress);
  if (dirty) {
    if (stored?.storyId === resolved.progress.storyId) {
      await updateCultivatorStory(cultivatorId, resolved.progress, tx);
    } else {
      if (stored) {
        await updateCultivatorStory(cultivatorId, { ...stored, status: 'completed' }, tx);
      }
      await insertCultivatorStory(cultivatorId, resolved.progress, tx);
    }
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
      : { items: false, spiritStones: false, cultivationExp: false };
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
    const { base, opened } = await currentStory(cultivatorId, q);
    return storyChapterUnlocks(
      getStoryChapter(base.storyId),
      base.beatId,
      opened,
    );
  },

  async read(cultivatorId: string, tx: DbTransaction): Promise<StoryView> {
    const { base, carried, opened } = await currentStory(cultivatorId, tx);
    const chapter = getStoryChapter(base.storyId);
    const facts = await readStoryFacts(cultivatorId, tx);
    const progress = rewindToUnwatchedPerformance(chapter, base, facts);
    return presentStory(chapter, progress, facts, carried, opened);
  },

  async completePassage(
    cultivatorId: string,
    input: CompleteStoryPassage,
    tx: DbTransaction,
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const { rows } = await currentStory(cultivatorId, tx);
    const mark = storyPassageMark(input.beatId, input.passageId);
    if (
      rows.some(
        (row) => row.storyId === input.chapterId && row.acks.includes(mark),
      )
    ) {
      return { view: await this.read(cultivatorId, tx), changes: [] };
    }
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      acknowledgeStoryPassage(chapter, progress, facts, input),
    );
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },

  async completePerformance(
    cultivatorId: string,
    scriptId: string,
    outcome: string,
    chosen: readonly string[],
    tx: DbTransaction,
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    if (scriptId === MINE_ROAD_SCRIPT && chosen.length !== 1) {
      throw new Error('请选一张山门路帖');
    }
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
    effects: readonly string[] = [],
  ): Promise<{ view: StoryView; changes: ResourceChangeDescriptor[] }> {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      acknowledgeBattle(chapter, progress, facts, battleId, outcome, effects),
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
    // 研习须重新核对当前宗门的真实心法等级，旧的研习标记不足以判断。
    if (fact !== 'sect_trained') {
      const { stored } = await currentStory(cultivatorId, tx);
      if (stored?.marks.includes(fact)) return null;
    }
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      noteStoryFact(chapter, progress, facts, fact),
    );
    if (!settled.dirty && settled.rewardIds.length === 0) return null;
    return {
      view: settled.view,
      changes: storyChanges(cultivatorId, settled.view, settled.effect),
    };
  },

  async noteForgedWeapon(cultivatorId: string, weaponId: string, tx: DbTransaction) {
    await lockCultivatorForStateMutation(tx, cultivatorId);
    const settled = await settle(cultivatorId, tx, (chapter, progress, facts) =>
      noteForgedStoryWeapon(chapter, progress, facts, weaponId),
    );
    return settled.dirty
      ? { changes: storyChanges(cultivatorId, settled.view, settled.effect) }
      : null;
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
