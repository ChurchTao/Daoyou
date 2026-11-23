import {
  baseMark,
  battleFlag,
  battleMark,
  flagMark,
  readBaseMark,
  readStoryWeaponId,
  standingReaches,
  storyFlags,
  storyWeaponMark,
  STORY_MARK_FACT_IDS,
  type StoryBattleOutcome,
  type StoryBeat,
  type StoryChapter,
  type StoryCondition,
  type StoryFactId,
  type StoryFacts,
  type StoryProgress,
  type StoryView,
} from '@daoyou/game-domain/story';
import { storyChapterUnlocks } from '@daoyou/game-domain/story/gates';

import {
  storyLocationHref,
  storyPassageMark,
  storyPlayHref,
} from './location.js';

const markFacts = new Set<StoryFactId>(STORY_MARK_FACT_IDS);
const arrivalRevisionMark = 'arrival-v2';
const mineClockOutAck = 'mine-shift-clock-out:done';
const mineStudyBriefAck = 'mine-lesson-study-brief:done';
const legacyArrivalBeats = new Set([
  'scent',
  'mouth',
  'lodge',
  'grass',
  'prints',
  'satchel',
  'wound',
  'spring',
  'steady',
  'grip',
]);

export function guideMark(lesson: string): string {
  return `guide:${lesson}`;
}

export interface StoryResolution {
  progress: StoryProgress;
  grants: string[];
  /** 这一章演完了，该接下一章。 */
  finished?: boolean;
}

function beatAt(chapter: StoryChapter, beatId: string): StoryBeat {
  const beat = chapter.beats.find((entry) => entry.id === beatId);
  if (!beat) throw new Error(`剧情幕不存在：${beatId}`);
  return beat;
}

function factReady(
  fact: StoryFactId,
  progress: StoryProgress,
  facts: StoryFacts,
): boolean {
  if (fact === 'story_weapon_equipped') {
    return Boolean(facts.equippedWeaponId &&
      facts.equippedWeaponId === readStoryWeaponId(progress.marks));
  }
  if (markFacts.has(fact)) return progress.marks.some((mark) => mark === fact);
  return facts[fact];
}

function acceptanceReady(
  acceptance: Extract<StoryBeat, { kind: 'practice' }>['accept'][number],
  progress: StoryProgress,
  facts: StoryFacts,
): boolean {
  if (acceptance.type === 'fact')
    return factReady(acceptance.fact, progress, facts);
  return progress.marks.includes(guideMark(acceptance.lesson));
}

function satisfied(
  beat: StoryBeat,
  progress: StoryProgress,
  facts: StoryFacts,
): boolean {
  if (beat.kind === 'performance') {
    return progress.acks.includes(`${beat.script}:${beat.outcome}`);
  }
  if (beat.kind === 'battle') {
    return progress.acks.includes(battleMark(beat.battle));
  }
  if (beat.kind === 'passage') {
    return progress.acks.includes(storyPassageMark(beat.id, beat.passage.id));
  }
  if (beat.kind === 'practice') {
    const ready = beat.accept.map((acceptance) =>
      acceptanceReady(acceptance, progress, facts),
    );
    return (beat.mode ?? 'any') === 'all'
      ? ready.every(Boolean)
      : ready.some(Boolean);
  }
  if (beat.kind === 'wait') {
    return conditionMet(beat.id, beat.until, progress, facts);
  }
  if (beat.kind === 'objective') {
    return beat.goals.every((goal) =>
      conditionMet(beat.id, goal.need, progress, facts),
    );
  }
  return false;
}

function conditionsOf(beat: StoryBeat): StoryCondition[] {
  if (beat.kind === 'wait') return [beat.until];
  if (beat.kind === 'objective') return beat.goals.map((goal) => goal.need);
  return [];
}

// 进了这一幕之后新做了几次。没记过起点就当还没开始。
function countedSince(
  beatId: string,
  condition: Extract<StoryCondition, { type: 'count' }>,
  progress: StoryProgress,
  facts: StoryFacts,
): number {
  const now = facts.counts?.[condition.count] ?? 0;
  const base = readBaseMark(progress.marks, beatId, condition.count) ?? now;
  return Math.max(0, now - base);
}

function conditionMet(
  beatId: string,
  condition: StoryCondition,
  progress: StoryProgress,
  facts: StoryFacts,
): boolean {
  if (condition.type === 'fact') {
    return factReady(condition.fact, progress, facts);
  }
  if (condition.type === 'flag') {
    return progress.marks.includes(flagMark(condition.flag));
  }
  if (condition.type === 'count') {
    return countedSince(beatId, condition, progress, facts) >= condition.atLeast;
  }
  return standingReaches(facts.standing, condition.realm, condition.stage);
}

// 站到一幕上，先把它要数的东西记个起点。
function withBaselines(
  beat: StoryBeat,
  progress: StoryProgress,
  facts: StoryFacts,
): StoryProgress {
  const marks = conditionsOf(beat).flatMap((condition) =>
    condition.type === 'count' &&
    readBaseMark(progress.marks, beat.id, condition.count) === null
      ? [baseMark(beat.id, condition.count, facts.counts?.[condition.count] ?? 0)]
      : [],
  );
  return marks.length > 0
    ? { ...progress, marks: [...progress.marks, ...new Set(marks)] }
    : progress;
}

function normalizeChapterProgress(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts?: StoryFacts,
): StoryProgress {
  if (progress.storyId !== chapter.id) return progress;
  // 旧版的找咪咪演出已经交代过下工。读过它的存档直接从原处续读。
  if (
    chapter.id === 'mine-shift' &&
    progress.acks.includes('mine-shift-work:done') &&
    !progress.acks.includes(mineClockOutAck)
  ) {
    return { ...progress, acks: [...progress.acks, mineClockOutAck] };
  }
  if (
    chapter.id === 'mine-lesson' &&
    progress.acks.includes('mine-lesson-form:done') &&
    !progress.acks.includes(mineStudyBriefAck)
  ) {
    return { ...progress, acks: [...progress.acks, mineStudyBriefAck] };
  }
  if (
    chapter.id === 'mine-lesson' &&
    progress.status === 'active' &&
    progress.beatId === 'form' &&
    !progress.acks.includes('mine-lesson-form:done') &&
    facts?.sect_methods_at_lesson_level === false
  ) {
    return { ...progress, beatId: 'study' };
  }
  // 旧版第四章把初选流派放在投名和找住处之间。现在留到早课。
  if (chapter.id === 'mine-gate' && progress.beatId === 'path') {
    return { ...progress, beatId: 'home' };
  }
  // 第四章旧存档已学完流派，接到初课后的晚饭。
  if (
    chapter.id === 'mountain-foothill' &&
    (progress.beatId === 'roots' || progress.beatId === 'errand')
  ) {
    return { ...progress, beatId: 'meal' };
  }
  if (chapter.id !== 'arrival') return progress;
  if (
    !chapter.beats.some((beat) => beat.id === progress.beatId) &&
    !legacyArrivalBeats.has(progress.beatId)
  ) {
    throw new Error(`剧情幕不存在：${progress.beatId}`);
  }
  // 旧教程只补一次缺项，之后不因卸下装备或退出宗门而回退。
  if (progress.marks.includes(arrivalRevisionMark) || !facts) return progress;
  const finished =
    progress.status === 'completed' ||
    (progress.beatId === 'entered' &&
      progress.acks.includes('arrival-remain:remained'));
  const beat = finished
    ? chapter.beats.find((entry) => entry.id === 'entered')
    : chapter.beats.find((entry) => !satisfied(entry, progress, facts));
  if (!beat) throw new Error('入世章节没有可停留的幕');
  return {
    ...progress,
    beatId: beat.id,
    marks: [...progress.marks, arrivalRevisionMark],
  };
}

function issuePayout(
  grants: string[],
  issued: string[],
  payout: string | undefined,
) {
  if (!payout || grants.includes(payout)) return;
  grants.push(payout);
  issued.push(payout);
}

export function resolveStory(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
): StoryResolution {
  if (progress.track !== chapter.track || progress.storyId !== chapter.id) {
    throw new Error(
      `剧情进度不属于这一章：${progress.track}/${progress.storyId}`,
    );
  }

  progress = normalizeChapterProgress(chapter, progress, facts);

  let beatId = progress.beatId;
  let finished = false;
  const grants = [...progress.grants];
  const issued: string[] = [];
  const seen = new Set<string>();

  while (!seen.has(beatId)) {
    seen.add(beatId);
    const beat = beatAt(chapter, beatId);
    progress = withBaselines(beat, progress, facts);
    if (chapter.id === 'arrival' && beat.kind === 'practice') {
      issuePayout(grants, issued, beat.grant);
    }
    if (!satisfied(beat, progress, facts)) break;
    if (beat.kind === 'practice' || beat.kind === 'objective') {
      issuePayout(grants, issued, beat.reward);
    }
    issuePayout(grants, issued, beat.gift);
    const index = chapter.beats.findIndex((entry) => entry.id === beatId);
    const next = chapter.beats[index + 1];
    if (!next) {
      issuePayout(grants, issued, chapter.completionGift);
      finished = true;
      break;
    }
    if (next.kind === 'practice' || next.kind === 'objective') {
      issuePayout(grants, issued, next.grant);
    }
    beatId = next.id;
  }

  return {
    progress: {
      ...progress,
      beatId,
      grants,
      status: finished ? 'completed' : progress.status,
    },
    grants: issued,
    finished,
  };
}

export function acknowledgePerformance(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  scriptId: string,
  outcome: string,
  chosen: { flags: readonly string[]; allowed: readonly string[] } = {
    flags: [],
    allowed: [],
  },
): StoryResolution {
  progress = normalizeChapterProgress(chapter, progress, facts);
  const key = `${scriptId}:${outcome}`;
  if (progress.acks.includes(key)) {
    return resolveStory(chapter, progress, facts);
  }
  const beat = beatAt(chapter, progress.beatId);
  if (beat.kind !== 'performance' || beat.script !== scriptId) {
    throw new Error('当前没有这场演出');
  }
  if (outcome === 'retry' && beat.retryLostBattle) {
    const previous = chapter.beats[chapter.beats.indexOf(beat) - 1];
    if (
      previous?.kind !== 'battle' ||
      !progress.marks.includes(flagMark(battleFlag(previous.battle, 'lost'))) ||
      chosen.flags.length > 0
    )
      throw new Error('只有这场试手落败后才能再试');
    const prefix = flagMark(`battle.${previous.battle}.`);
    return resolveStory(
      chapter,
      {
        ...progress,
        beatId: previous.id,
        acks: progress.acks.filter((ack) => ack !== battleMark(previous.battle)),
        marks: progress.marks.filter((mark) => !mark.startsWith(prefix)),
      },
      facts,
    );
  }
  if (beat.outcome !== outcome) throw new Error('演出结果不属于这一幕');
  if (chosen.flags.some((flag) => !chosen.allowed.includes(flag))) {
    throw new Error('演出里没有这个选择');
  }
  const marks = chosen.flags
    .map(flagMark)
    .filter((mark) => !progress.marks.includes(mark));
  return resolveStory(
    chapter,
    {
      ...progress,
      acks: [...progress.acks, key],
      marks: [...progress.marks, ...new Set(marks)],
    },
    facts,
  );
}

export function acknowledgeStoryPassage(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  input: { chapterId: string; beatId: string; passageId: string },
): StoryResolution {
  progress = normalizeChapterProgress(chapter, progress, facts);
  const beat = beatAt(chapter, progress.beatId);
  if (
    chapter.id !== input.chapterId ||
    beat.id !== input.beatId ||
    beat.kind !== 'passage' ||
    beat.passage.id !== input.passageId ||
    (beat.location.kind === 'sect' && !facts.sect_joined)
  )
    throw new Error('当前没有这段行程');
  const key = storyPassageMark(beat.id, beat.passage.id);
  if (progress.acks.includes(key))
    return resolveStory(chapter, progress, facts);
  return resolveStory(
    chapter,
    { ...progress, acks: [...progress.acks, key] },
    facts,
  );
}

/** 剧情战打完了。结果记成标记，后面的演出可以照着分支。 */
export function acknowledgeBattle(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  battleId: string,
  outcome: StoryBattleOutcome,
  effects: readonly string[] = [],
): StoryResolution {
  const key = battleMark(battleId);
  if (progress.acks.includes(key)) return resolveStory(chapter, progress, facts);
  const beat = beatAt(chapter, progress.beatId);
  if (beat.kind !== 'battle' || beat.battle !== battleId) {
    throw new Error('当前没有这场剧情战');
  }
  const mark = flagMark(battleFlag(battleId, outcome));
  return resolveStory(
    chapter,
    {
      ...progress,
      acks: [...progress.acks, key],
      marks: [...new Set([...progress.marks, mark, ...effects.map(flagMark)])],
    },
    facts,
  );
}

export function noteStoryFact(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  fact: (typeof STORY_MARK_FACT_IDS)[number],
): StoryResolution {
  if (progress.track !== chapter.track || progress.storyId !== chapter.id) {
    throw new Error(
      `剧情进度不属于这一章：${progress.track}/${progress.storyId}`,
    );
  }
  if (progress.marks.includes(fact))
    return resolveStory(chapter, progress, facts);
  return resolveStory(
    chapter,
    { ...progress, marks: [...progress.marks, fact] },
    facts,
  );
}

export function noteForgedStoryWeapon(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  weaponId: string,
): StoryResolution {
  if (chapter.id !== 'mountain-forge')
    return noteStoryFact(chapter, progress, facts, 'weapon_forged');
  // 只认借炉后实际铸出的成品。试手前如重铸，改用新铸成的法兵。
  if (progress.beatId !== 'forge' && progress.beatId !== 'cool' && progress.beatId !== 'equip')
    return resolveStory(chapter, progress, facts);
  const previous = readStoryWeaponId(progress.marks);
  const marks = previous
    ? progress.marks.filter((mark) => mark !== storyWeaponMark(previous))
    : progress.marks;
  return noteStoryFact(
    chapter,
    { ...progress, marks: [...marks, storyWeaponMark(weaponId)] },
    facts,
    'weapon_forged',
  );
}

export function acknowledgeGuide(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  lesson: string,
): StoryResolution {
  progress = normalizeChapterProgress(chapter, progress, facts);
  const beat = beatAt(chapter, progress.beatId);
  const wanted =
    (beat.kind === 'battle' && beat.lesson === lesson) ||
    (beat.kind === 'practice' &&
      (beat.lesson === lesson ||
        beat.accept.some(
          (entry) => entry.type === 'guide' && entry.lesson === lesson,
        )));
  if (!wanted) throw new Error('当前没有这场教学');
  const key = guideMark(lesson);
  if (progress.marks.includes(key))
    return resolveStory(chapter, progress, facts);
  return resolveStory(
    chapter,
    { ...progress, marks: [...progress.marks, key] },
    facts,
  );
}

export function rewindToUnwatchedPerformance(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts?: StoryFacts,
): StoryProgress {
  if (progress.track !== chapter.track || progress.storyId !== chapter.id) {
    return progress;
  }
  progress = normalizeChapterProgress(chapter, progress, facts);
  if (
    chapter.id === 'arrival' &&
    progress.beatId === 'entered' &&
    (progress.status === 'completed' ||
      progress.acks.includes('arrival-remain:remained'))
  ) {
    return progress;
  }
  const currentIndex = chapter.beats.findIndex(
    (beat) => beat.id === progress.beatId,
  );
  if (currentIndex < 0) return progress;
  for (let index = 0; index < currentIndex; index += 1) {
    const beat = chapter.beats[index];
    if (!beat || beat.kind !== 'performance') continue;
    const key = `${beat.script}:${beat.outcome}`;
    if (!progress.acks.includes(key)) {
      return { ...progress, beatId: beat.id, status: 'active' };
    }
  }
  return progress;
}

export function presentStory(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  /** 别的章节里记下的标记。 */
  carried: readonly string[] = [],
  /** 演完的章节里开放过的入口。 */
  opened: readonly string[] = [],
): StoryView {
  progress = normalizeChapterProgress(chapter, progress, facts);
  const beat = beatAt(chapter, progress.beatId);
  const shifted =
    beat.kind === 'life' &&
    beat.when &&
    factReady(beat.when.fact, progress, facts)
      ? beat.when
      : beat;
  const weaponId =
    beat.kind === 'practice' &&
    beat.accept.some(
      (entry) =>
        entry.type === 'fact' && entry.fact === 'story_weapon_equipped',
    )
      ? readStoryWeaponId(progress.marks)
      : undefined;
  const missingItemAction =
    weaponId && beat.kind === 'practice' ? beat.missingItemAction : undefined;
  const location = beat.location;
  const activityHref = 'href' in shifted ? shifted.href : undefined;
  let href =
    beat.kind === 'passage'
      ? storyLocationHref(beat.location, Boolean(beat.passage.hint))
      : location
        ? location.kind === 'cave' && activityHref?.split('?')[0] === '/game'
          ? activityHref
          : storyLocationHref(location)
        : (activityHref ?? '/game');
  let playHref =
    location && activityHref && activityHref !== href && beat.kind !== 'life'
      ? storyPlayHref(activityHref, { chapterId: chapter.id, beatId: beat.id })
      : undefined;
  if (weaponId && (!location || playHref)) {
    const target = new URL(playHref ?? href, 'http://story.local');
    target.searchParams.set('item', weaponId);
    const targetHref = target.pathname + target.search + target.hash;
    if (playHref) playHref = targetHref;
    else href = targetHref;
  }
  const unlocked = storyChapterUnlocks(chapter, beat.id, opened);
  return {
    track: progress.track,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    beatId: beat.id,
    kind: beat.kind,
    scene: beat.scene,
    prompt: shifted.prompt,
    href,
    ...(location ? { location } : {}),
    ...(beat.entry ? { entry: beat.entry } : {}),
    ...(beat.kind === 'passage' ? { passage: beat.passage } : {}),
    ...(beat.kind === 'performance' && beat.finishLabel
      ? { finishLabel: beat.finishLabel }
      : {}),
    ...(playHref ? { playHref } : {}),
    ...(beat.kind === 'performance' && beat.playOnResume && playHref
      ? { resumeHref: playHref }
      : {}),
    ...(shifted.actionLabel ? { actionLabel: shifted.actionLabel } : {}),
    ...(shifted.indicatorFrom ? { indicatorFrom: shifted.indicatorFrom } : {}),
    ...(beat.kind === 'performance' && beat.exitHref
      ? { exitHref: beat.exitHref }
      : {}),
    scriptId: beat.kind === 'performance' ? beat.script : null,
    battleId: beat.kind === 'battle' ? beat.battle : null,
    hail: beat.hail
      ? {
          by: beat.hail.by,
          portrait: beat.hail.portrait ?? null,
          line: beat.hail.line,
        }
      : null,
    guideLesson: pendingGuide(beat, progress),
    ...(weaponId
      ? { targetItem: { id: weaponId, missingAction: missingItemAction } }
      : {}),
    unlocked,
    fresh: unlocked ? [...(beat.unlocks ?? [])] : [],
    flags: [...new Set([...carried, ...storyFlags(progress.marks)])],
    goals:
      beat.kind === 'objective'
        ? beat.goals.map((goal) => ({
            label: goal.label,
            done: conditionMet(beat.id, goal.need, progress, facts),
            current:
              goal.need.type === 'count'
                ? Math.min(
                    goal.need.atLeast,
                    countedSince(beat.id, goal.need, progress, facts),
                  )
                : null,
            target: goal.need.type === 'count' ? goal.need.atLeast : null,
          }))
        : beat.kind === 'practice'
          ? beat.accept.flatMap((entry) => {
              if (entry.type !== 'fact' || !entry.progressLabel) return [];
              const counter = facts.factProgress?.[entry.fact];
              return counter
                ? [
                    {
                      label: entry.progressLabel,
                      done: factReady(entry.fact, progress, facts),
                      ...counter,
                    },
                  ]
                : [];
            })
          : [],
  };
}

function pendingGuide(beat: StoryBeat, progress: StoryProgress): string | null {
  if (beat.kind !== 'practice' && beat.kind !== 'battle') return null;
  const lesson =
    beat.kind === 'battle'
      ? beat.lesson
      : (beat.lesson ??
        beat.accept.find((acceptance) => acceptance.type === 'guide')?.lesson);
  if (!lesson || progress.marks.includes(guideMark(lesson))) return null;
  return lesson;
}
