import { createStoryChapterSchema } from '@daoyou/game-domain/story';
import { getGuideLesson } from '../guide/catalog.js';
import { hasStoryBattle } from './battles.js';
import { hasStoryReward } from './rewards.js';

export const { StoryChapterSchema } = createStoryChapterSchema({
  getGuideLesson,
  hasStoryReward,
  hasStoryBattle,
});
