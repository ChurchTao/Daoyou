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

function satisfied(
  beat: StoryBeat,
  progress: StoryProgress,
  facts: StoryFacts,
): boolean {
  if (beat.kind === 'performance') {
    return progress.acks.includes(`${beat.script}:${beat.outcome}`);
  }
  if (beat.kind === 'practice') return factReady(beat.fact, progress, facts);
  return false;
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
    const index = chapter.beats.findIndex((entry) => entry.id === beatId);
    const next = chapter.beats[index + 1];
    if (!next) break;
    if (next.kind === 'practice' && next.grant && !grants.includes(next.grant)) {
      grants.push(next.grant);
      issued.push(next.grant);
    }
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
  };
}
