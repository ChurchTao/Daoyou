import {
  baseMark,
  chapterUnlocks,
  flagMark,
  readBaseMark,
  standingReaches,
  storyFlags,
  STORY_MARK_FACT_IDS,
  type StoryBeat,
  type StoryChapter,
  type StoryCondition,
  type StoryFactId,
  type StoryFacts,
  type StoryProgress,
  type StoryView,
} from '@daoyou/game-domain/story';

const markFacts = new Set<StoryFactId>(STORY_MARK_FACT_IDS);
const arrivalRevisionMark = 'arrival-v2';
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

function normalizeArrivalProgress(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts?: StoryFacts,
): StoryProgress {
  if (chapter.id !== 'arrival' || progress.storyId !== chapter.id) {
    return progress;
  }
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

  progress = normalizeArrivalProgress(chapter, progress, facts);

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
    const index = chapter.beats.findIndex((entry) => entry.id === beatId);
    const next = chapter.beats[index + 1];
    if (!next) {
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
  progress = normalizeArrivalProgress(chapter, progress, facts);
  const key = `${scriptId}:${outcome}`;
  if (progress.acks.includes(key)) {
    return resolveStory(chapter, progress, facts);
  }
  const beat = beatAt(chapter, progress.beatId);
  if (beat.kind !== 'performance' || beat.script !== scriptId) {
    throw new Error('当前没有这场演出');
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

export function acknowledgeGuide(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  lesson: string,
): StoryResolution {
  progress = normalizeArrivalProgress(chapter, progress, facts);
  const beat = beatAt(chapter, progress.beatId);
  const wanted =
    beat.kind === 'practice' &&
    (beat.lesson === lesson ||
      beat.accept.some(
        (entry) => entry.type === 'guide' && entry.lesson === lesson,
      ));
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
  progress = normalizeArrivalProgress(chapter, progress, facts);
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
  progress = normalizeArrivalProgress(chapter, progress, facts);
  const beat = beatAt(chapter, progress.beatId);
  const shifted =
    beat.kind === 'life' &&
    beat.when &&
    factReady(beat.when.fact, progress, facts)
      ? { prompt: beat.when.prompt, href: beat.when.href }
      : { prompt: beat.prompt, href: beat.href };
  return {
    track: progress.track,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    beatId: beat.id,
    kind: beat.kind,
    scene: beat.scene,
    prompt: shifted.prompt,
    href: shifted.href,
    scriptId: beat.kind === 'performance' ? beat.script : null,
    guideLesson: pendingGuide(beat, progress),
    classroom: beat.kind === 'practice' ? (beat.classroom ?? null) : null,
    unlocked: chapter.gated
      ? [...new Set([...opened, ...chapterUnlocks(chapter, beat.id)])]
      : null,
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
        : [],
  };
}

function pendingGuide(beat: StoryBeat, progress: StoryProgress): string | null {
  if (beat.kind !== 'practice') return null;
  const lesson =
    beat.lesson ??
    beat.accept.find((acceptance) => acceptance.type === 'guide')?.lesson;
  if (!lesson || progress.marks.includes(guideMark(lesson))) return null;
  return lesson;
}
