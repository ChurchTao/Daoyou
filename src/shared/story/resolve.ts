import {
  STORY_MARK_FACT_IDS,
  type StoryBeat,
  type StoryChapter,
  type StoryFactId,
  type StoryFacts,
  type StoryProgress,
  type StoryView,
} from './schema';

const markFacts = new Set<StoryFactId>(STORY_MARK_FACT_IDS);

export function guideMark(lesson: string): string {
  return `guide:${lesson}`;
}

export interface StoryResolution {
  progress: StoryProgress;
  grants: string[];
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
  if (acceptance.type === 'fact') return factReady(acceptance.fact, progress, facts);
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
    return (beat.mode ?? 'any') === 'all' ? ready.every(Boolean) : ready.some(Boolean);
  }
  return false;
}

function issuePayout(grants: string[], issued: string[], payout: string | undefined) {
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
    throw new Error(`剧情进度不属于这一章：${progress.track}/${progress.storyId}`);
  }

  let beatId = progress.beatId;
  const grants = [...progress.grants];
  const issued: string[] = [];
  const seen = new Set<string>();

  while (!seen.has(beatId)) {
    seen.add(beatId);
    const beat = beatAt(chapter, beatId);
    if (!satisfied(beat, progress, facts)) break;
    if (beat.kind === 'practice') issuePayout(grants, issued, beat.reward);
    const index = chapter.beats.findIndex((entry) => entry.id === beatId);
    const next = chapter.beats[index + 1];
    if (!next) break;
    if (next.kind === 'practice') issuePayout(grants, issued, next.grant);
    beatId = next.id;
  }

  return {
    progress: { ...progress, beatId, grants },
    grants: issued,
  };
}

export function acknowledgePerformance(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
  scriptId: string,
  outcome: string,
): StoryResolution {
  const key = `${scriptId}:${outcome}`;
  if (progress.acks.includes(key)) {
    return resolveStory(chapter, progress, facts);
  }
  const beat = beatAt(chapter, progress.beatId);
  if (beat.kind !== 'performance' || beat.script !== scriptId) {
    throw new Error('当前没有这场演出');
  }
  if (beat.outcome !== outcome) throw new Error('演出结果不属于这一幕');
  return resolveStory(
    chapter,
    { ...progress, acks: [...progress.acks, key] },
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
    throw new Error(`剧情进度不属于这一章：${progress.track}/${progress.storyId}`);
  }
  if (progress.marks.includes(fact)) return resolveStory(chapter, progress, facts);
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
  const beat = beatAt(chapter, progress.beatId);
  const wanted =
    beat.kind === 'practice' &&
    beat.accept.some((entry) => entry.type === 'guide' && entry.lesson === lesson);
  if (!wanted) throw new Error('当前没有这场教学');
  const key = guideMark(lesson);
  if (progress.marks.includes(key)) return resolveStory(chapter, progress, facts);
  return resolveStory(
    chapter,
    { ...progress, marks: [...progress.marks, key] },
    facts,
  );
}

export function rewindToUnwatchedPerformance(
  chapter: StoryChapter,
  progress: StoryProgress,
): StoryProgress {
  if (progress.track !== chapter.track || progress.storyId !== chapter.id) {
    return progress;
  }
  const opening = chapter.beats.find((beat) => beat.kind === 'performance');
  if (!opening || opening.kind !== 'performance') return progress;
  const key = `${opening.script}:${opening.outcome}`;
  if (progress.acks.includes(key) || progress.beatId === opening.id) {
    return progress;
  }
  return { ...progress, beatId: opening.id, status: 'active' };
}

export function presentStory(
  chapter: StoryChapter,
  progress: StoryProgress,
  facts: StoryFacts,
): StoryView {
  const beat = beatAt(chapter, progress.beatId);
  const shifted =
    beat.kind === 'life' && beat.when && factReady(beat.when.fact, progress, facts)
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
  };
}

function pendingGuide(beat: StoryBeat, progress: StoryProgress): string | null {
  if (beat.kind !== 'practice') return null;
  for (const acceptance of beat.accept) {
    if (acceptance.type !== 'guide') continue;
    if (!progress.marks.includes(guideMark(acceptance.lesson))) return acceptance.lesson;
  }
  return null;
}
