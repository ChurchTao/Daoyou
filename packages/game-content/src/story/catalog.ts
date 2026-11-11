import { StoryChapterSchema } from './schema.js';

import arrivalChapter from './data/arrival.json' with { type: 'json' };
import v1Creek from './data/v1-creek.json' with { type: 'json' };
import v1Gate from './data/v1-gate.json' with { type: 'json' };
import v1Registered from './data/v1-registered.json' with { type: 'json' };
import v1Alchemy from './data/v1-alchemy.json' with { type: 'json' };
import v1Qingxi from './data/v1-qingxi.json' with { type: 'json' };
import v1Drill from './data/v1-drill.json' with { type: 'json' };
import v1Exam from './data/v1-exam.json' with { type: 'json' };
import v1Market from './data/v1-market.json' with { type: 'json' };
import v1Foundation from './data/v1-foundation.json' with { type: 'json' };
import v1Kin from './data/v1-kin.json' with { type: 'json' };
import v1After from './data/v1-after.json' with { type: 'json' };

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
  ['v1-creek', parseChapter(v1Creek)],
  ['v1-gate', parseChapter(v1Gate)],
  ['v1-registered', parseChapter(v1Registered)],
  ['v1-alchemy', parseChapter(v1Alchemy)],
  ['v1-qingxi', parseChapter(v1Qingxi)],
  ['v1-drill', parseChapter(v1Drill)],
  ['v1-exam', parseChapter(v1Exam)],
  ['v1-market', parseChapter(v1Market)],
  ['v1-foundation', parseChapter(v1Foundation)],
  ['v1-kin', parseChapter(v1Kin)],
  ['v1-after', parseChapter(v1After)],
]);

for (const chapter of chapters.values()) {
  if (chapter.next && !chapters.has(chapter.next)) {
    throw new Error(`剧情章节接不上：${chapter.id} → ${chapter.next}`);
  }
}

/** 新角色的主线从这一章开始。 */
export const OPENING_STORY_CHAPTER = 'v1-creek';

export function getStoryChapter(id = 'arrival'): StoryChapter {
  const chapter = chapters.get(id);
  if (!chapter) throw new Error(`剧情章节不存在：${id}`);
  return chapter;
}
