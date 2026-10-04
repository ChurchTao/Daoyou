import { StoryChapterSchema } from './schema.js';

import arrivalChapter from './data/arrival.json' with { type: 'json' };

import { getPerformanceScript } from '../performance/catalog.js';

import { type StoryChapter } from '@daoyou/game-domain/story';

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
