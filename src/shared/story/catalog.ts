import arrivalChapter from '../content/story/arrival.json';
import { getPerformanceScript } from '../performance/catalog';
import {
  StoryChapterSchema,
  StoryProgressSchema,
  type StoryChapter,
  type StoryProgress,
} from './schema';

function parseChapter(input: unknown): StoryChapter {
  const chapter = StoryChapterSchema.parse(input);
  for (const beat of chapter.beats) {
    if (beat.kind !== 'performance') continue;
    const script = getPerformanceScript(beat.script);
    const endings = new Set(
      script.cues.flatMap((cue) => {
        if (cue.type === 'end') return [cue.outcome];
        if (cue.type === 'choice') {
          return cue.options.flatMap((option) =>
            option.outcome ? [option.outcome] : [],
          );
        }
        return [];
      }),
    );
    if (!endings.has(beat.outcome)) {
      throw new Error(`剧情幕结果不属于演出：${beat.id}`);
    }
  }
  return chapter;
}

const chapters = new Map<string, StoryChapter>([
  ['arrival', parseChapter(arrivalChapter)],
]);

export function getStoryChapter(id = 'arrival'): StoryChapter {
  const chapter = chapters.get(id);
  if (!chapter) throw new Error(`剧情章节不存在：${id}`);
  return chapter;
}

export function openingStoryProgress(): StoryProgress {
  const chapter = getStoryChapter();
  const beat = chapter.beats[0];
  if (!beat) throw new Error('入世章节没有第一幕');
  return StoryProgressSchema.parse({
    track: chapter.track,
    storyId: chapter.id,
    beatId: beat.id,
    status: 'active',
    acks: [],
    grants: [],
    marks: [],
  });
}

export function restingStoryProgress(): StoryProgress {
  const chapter = getStoryChapter();
  const beat = [...chapter.beats].reverse().find((entry) => entry.kind === 'life');
  if (!beat) throw new Error('入世章节没有可停留的幕');
  return StoryProgressSchema.parse({
    track: chapter.track,
    storyId: chapter.id,
    beatId: beat.id,
    status: 'active',
    acks: [],
    grants: [],
    marks: [],
  });
}

export function parseStoryProgress(input: unknown): StoryProgress {
  return StoryProgressSchema.parse(input);
}
