import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import {
  StoryProgressSchema,
  type StoryProgress,
} from '@daoyou/game-domain/story';

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
  const beat = [...chapter.beats]
    .reverse()
    .find((entry) => entry.kind === 'life');
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
