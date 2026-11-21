import { StoryChapterSchema } from './schema.js';

import arrivalChapter from './data/arrival.json' with { type: 'json' };
import mountainBend from './data/mountain-bend.json' with { type: 'json' };
import mountainFerry from './data/mountain-ferry.json' with { type: 'json' };
import mountainFlowers from './data/mountain-flowers.json' with { type: 'json' };
import mountainLodging from './data/mountain-lodging.json' with { type: 'json' };
import mountainFoothill from './data/mountain-foothill.json' with { type: 'json' };
import mountainForge from './data/mountain-forge.json' with { type: 'json' };
import mountainSparring from './data/mountain-sparring.json' with { type: 'json' };
import mineShift from './data/mine-shift.json' with { type: 'json' };
import mineCrossing from './data/mine-crossing.json' with { type: 'json' };
import mineDeparture from './data/mine-departure.json' with { type: 'json' };
import mineGate from './data/mine-gate.json' with { type: 'json' };
import mineLodging from './data/mine-lodging.json' with { type: 'json' };
import mineLesson from './data/mine-lesson.json' with { type: 'json' };
import mineSparring from './data/mine-sparring.json' with { type: 'json' };

import { getPerformanceScript } from '../performance/catalog.js';

import { chapterUnlocks, type StoryChapter } from '@daoyou/game-domain/story';
import { isStoryGate, storySceneOpen } from '@daoyou/game-domain/story/gates';

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
    if (beat.retryLostBattle && !endings.has('retry')) {
      throw new Error(`剧情幕缺少再试选项：${beat.id}`);
    }
  }
  return chapter;
}

const chapters = new Map<string, StoryChapter>([
  ['arrival', parseChapter(arrivalChapter)],
  ['mountain-ferry', parseChapter(mountainFerry)],
  ['mountain-flowers', parseChapter(mountainFlowers)],
  ['mountain-bend', parseChapter(mountainBend)],
  ['mountain-lodging', parseChapter(mountainLodging)],
  ['mountain-foothill', parseChapter(mountainFoothill)],
  ['mountain-forge', parseChapter(mountainForge)],
  ['mountain-sparring', parseChapter(mountainSparring)],
  [mineShift.id, parseChapter(mineShift)],
  [mineCrossing.id, parseChapter(mineCrossing)],
  [mineDeparture.id, parseChapter(mineDeparture)],
  [mineGate.id, parseChapter(mineGate)],
  [mineLesson.id, parseChapter(mineLesson)],
  [mineSparring.id, parseChapter(mineSparring)],
  [mineLodging.id, parseChapter(mineLodging)],
]);

export const OPENING_STORY_CHAPTER = 'mine-shift';
export const RESTING_STORY_CHAPTER = 'mine-lodging';

for (const chapter of chapters.values()) {
  if (chapter.next && !chapters.has(chapter.next)) {
    throw new Error(`剧情章节接不上：${chapter.id} → ${chapter.next}`);
  }
}

// 入口开放要对得上总表：门的编号都认得；新手期每一幕要去的地方，走到那一幕时已经开了。
{
  const opened: string[] = [];
  let chapter = chapters.get(OPENING_STORY_CHAPTER);
  const seen = new Set<string>();
  while (chapter && !seen.has(chapter.id)) {
    seen.add(chapter.id);
    for (const beat of chapter.beats) {
      for (const gate of beat.unlocks ?? []) {
        if (!isStoryGate(gate))
          throw new Error(
            `入口总表里没有这道门：${chapter.id}/${beat.id} → ${gate}`,
          );
      }
      if (!chapter.gated) continue;
      const unlocked = [...opened, ...chapterUnlocks(chapter, beat.id)];
      if (!storySceneOpen(unlocked, beat.scene))
        throw new Error(
          `这一幕要去的地方还没开放：${chapter.id}/${beat.id} → ${beat.scene}`,
        );
    }
    opened.push(...chapterUnlocks(chapter));
    chapter = chapter.next ? chapters.get(chapter.next) : undefined;
  }
}

export function getStoryChapter(id = OPENING_STORY_CHAPTER): StoryChapter {
  const chapter = chapters.get(id);
  if (!chapter) throw new Error(`剧情章节不存在：${id}`);
  return chapter;
}
