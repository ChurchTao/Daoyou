import { StoryChapterSchema } from './schema.js';

import arrivalChapter from './data/arrival.json' with { type: 'json' };
import mineBaishui from './data/mine-baishui.json' with { type: 'json' };
import mineBaishuiLamp from './data/mine-baishui-lamp.json' with { type: 'json' };
import mineBaishuiNight from './data/mine-baishui-night.json' with { type: 'json' };
import mineBaishuiMedicine from './data/mine-baishui-medicine.json' with { type: 'json' };
import mineCrossing from './data/mine-crossing.json' with { type: 'json' };
import mineDeparture from './data/mine-departure.json' with { type: 'json' };
import mineErrand from './data/mine-errand.json' with { type: 'json' };
import mineGate from './data/mine-gate.json' with { type: 'json' };
import mineLesson from './data/mine-lesson.json' with { type: 'json' };
import mineLodging from './data/mine-lodging.json' with { type: 'json' };
import mineShift from './data/mine-shift.json' with { type: 'json' };
import mineSparring from './data/mine-sparring.json' with { type: 'json' };
import mountainBend from './data/mountain-bend.json' with { type: 'json' };
import mountainFerry from './data/mountain-ferry.json' with { type: 'json' };
import mountainFlowers from './data/mountain-flowers.json' with { type: 'json' };
import mountainFoothill from './data/mountain-foothill.json' with { type: 'json' };
import mountainForge from './data/mountain-forge.json' with { type: 'json' };
import mountainLodging from './data/mountain-lodging.json' with { type: 'json' };
import mountainSparring from './data/mountain-sparring.json' with { type: 'json' };

import { getPerformanceScript } from '../performance/catalog.js';

import { chapterUnlocks, type StoryChapter } from '@daoyou/game-domain/story';
import {
  isStoryGate,
  storyChapterUnlocks,
  storySceneOpen,
} from '@daoyou/game-domain/story/gates';
import { sameMapPlace, type MapPlaceRef } from '@daoyou/game-domain/world/map';
import { STANDARD_SECT_PRESENTATION } from '../sect-organization/standard/presentation.js';
import { getMapAreaContent, getMapPassage } from '../world/areas.js';
import { getMapNode } from '../world/map.js';
import { getSectStoryEntry } from '../world/sect-story-entries.js';

const sectSpots = new Set(
  STANDARD_SECT_PRESENTATION.map.hotspots.map(({ id }) => id),
);

function areaPlace(location: Extract<MapPlaceRef, { kind: 'area' }>) {
  const node = getMapNode(location.areaId);
  if (!node || !('region' in node)) return undefined;
  return getMapAreaContent(location.areaId)?.places.find(
    ({ id }) => id === location.placeId,
  );
}

function parseChapter(input: unknown): StoryChapter {
  const chapter = StoryChapterSchema.parse(input);
  for (const beat of chapter.beats) {
    if ('arrival' in beat && beat.arrival) {
      if (
        !beat.location ||
        (beat.arrival === 'activity' &&
          (beat.kind === 'passage' || !beat.href)) ||
        (beat.arrival === 'map' &&
          (beat.kind !== 'passage' || !beat.passage.hint)) ||
        (beat.arrival === 'location' &&
          beat.kind === 'passage' &&
          beat.passage.hint)
      ) {
        throw new Error(`剧情转场配置无效：${chapter.id}/${beat.id}`);
      }
    }
    if (beat.entry && (!beat.location || beat.location.kind === 'cave')) {
      throw new Error(`剧情入口缺少地点：${chapter.id}/${beat.id}`);
    }
    if (beat.location?.kind === 'area') {
      const place = areaPlace(beat.location);
      const entries =
        beat.entry?.kind === 'npc'
          ? place?.scene?.npcs
          : place?.scene?.facilities;
      if (
        !place ||
        (beat.entry && !entries?.some(({ id }) => id === beat.entry?.id))
      ) {
        throw new Error(`剧情地点或现场入口不存在：${chapter.id}/${beat.id}`);
      }
    }
    if (
      beat.location?.kind === 'sect' &&
      (!sectSpots.has(beat.location.spotId) ||
        (beat.entry && !getSectStoryEntry(beat.location.spotId, beat.entry)))
    ) {
      throw new Error(`宗门剧情地点或现场入口不存在：${chapter.id}/${beat.id}`);
    }
    if (beat.kind === 'passage') {
      const passage = getMapPassage(beat.passage.id);
      if (
        !passage ||
        !sameMapPlace(passage.from, beat.location) ||
        (passage.to.kind === 'area' && !areaPlace(passage.to)) ||
        (beat.passage.hint &&
          (passage.from.kind !== 'area' ||
            passage.to.kind !== 'area' ||
            passage.to.areaId !== passage.from.areaId))
      ) {
        throw new Error(`剧情通路配置无效：${chapter.id}/${beat.id}`);
      }
    }
    if (beat.kind !== 'performance') continue;
    if (
      beat.playOnResume &&
      (!beat.location || !beat.entry || beat.href !== '/game/story')
    ) {
      throw new Error(`续读演出缺少有效入口：${chapter.id}/${beat.id}`);
    }
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
  [mineErrand.id, parseChapter(mineErrand)],
  [mineBaishui.id, parseChapter(mineBaishui)],
  [mineBaishuiLamp.id, parseChapter(mineBaishuiLamp)],
  [mineBaishuiNight.id, parseChapter(mineBaishuiNight)],
  [mineBaishuiMedicine.id, parseChapter(mineBaishuiMedicine)],
  [mineLodging.id, parseChapter(mineLodging)],
]);

export const OPENING_STORY_CHAPTER = 'mine-shift';
export const RESTING_STORY_CHAPTER = 'mine-lodging';

for (const chapter of chapters.values()) {
  if (chapter.next && !chapters.has(chapter.next)) {
    throw new Error(`剧情章节接不上：${chapter.id} → ${chapter.next}`);
  }
  for (const gate of chapter.deferredUnlocks ?? []) {
    if (!isStoryGate(gate))
      throw new Error(`剧情章节延后的入口不存在：${chapter.id} → ${gate}`);
  }
  for (const [index, beat] of chapter.beats.entries()) {
    if (beat.kind !== 'passage') continue;
    const passage = getMapPassage(beat.passage.id);
    const next =
      chapter.beats[index + 1] ??
      (chapter.next ? chapters.get(chapter.next)?.beats[0] : undefined);
    if (
      !passage ||
      !next?.location ||
      !sameMapPlace(passage.to, next.location)
    ) {
      throw new Error(`剧情通路抵达后没有对应地点：${chapter.id}/${beat.id}`);
    }
  }
}

// 入口开放要对得上总表：门的编号都认得；新手期每一幕要去的地方，走到那一幕时已经开了。
{
  const opened: string[] = [];
  let chapter = chapters.get(OPENING_STORY_CHAPTER);
  const seen = new Set<string>();
  while (chapter) {
    if (seen.has(chapter.id)) {
      throw new Error(`主线章节循环接续：${chapter.id}`);
    }
    seen.add(chapter.id);
    for (const beat of chapter.beats) {
      if (!beat.location) {
        throw new Error(`主线幕缺少地点：${chapter.id}/${beat.id}`);
      }
      if (
        beat.location.kind !== 'cave' &&
        (beat.kind === 'performance' ||
          beat.kind === 'battle' ||
          beat.kind === 'practice') &&
        !beat.entry
      ) {
        throw new Error(`主线幕缺少现场入口：${chapter.id}/${beat.id}`);
      }
      for (const gate of beat.unlocks ?? []) {
        if (!isStoryGate(gate))
          throw new Error(
            `入口总表里没有这道门：${chapter.id}/${beat.id} → ${gate}`,
          );
      }
      const unlocked = storyChapterUnlocks(chapter, beat.id, opened);
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
