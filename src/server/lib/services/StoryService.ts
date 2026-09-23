import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  findCultivatorStory,
  insertCultivatorStory,
  updateCultivatorStory,
} from '@server/lib/repositories/storyRepository';
import {
  getStoryChapter,
  restingStoryProgress,
} from '@shared/story/catalog';
import {
  acknowledgePerformance,
  presentStory,
  rewindToUnwatchedPerformance,
} from '@shared/story/resolve';
import { emptyStoryFacts, type StoryView } from '@shared/story/schema';

const MAIN_STORY_ID = 'arrival';

export const StoryService = {
  async read(cultivatorId: string, tx: DbTransaction): Promise<StoryView> {
    const stored =
      (await findCultivatorStory(cultivatorId, 'main', MAIN_STORY_ID, tx)) ??
      restingStoryProgress();
    const chapter = getStoryChapter(stored.storyId);
    const progress = rewindToUnwatchedPerformance(chapter, stored);
    return presentStory(chapter, progress, emptyStoryFacts());
  },

  async completePerformance(
    cultivatorId: string,
    scriptId: string,
    outcome: string,
    tx: DbTransaction,
  ): Promise<StoryView> {
    const stored = await findCultivatorStory(
      cultivatorId,
      'main',
      MAIN_STORY_ID,
      tx,
    );
    const chapter = getStoryChapter((stored ?? restingStoryProgress()).storyId);
    const progress = rewindToUnwatchedPerformance(
      chapter,
      stored ?? restingStoryProgress(),
    );
    const facts = emptyStoryFacts();
    const resolved = acknowledgePerformance(
      chapter,
      progress,
      facts,
      scriptId,
      outcome,
    );
    if (resolved.grants.length > 0) {
      throw new Error('这一幕还没有可发放的物品');
    }
    if (stored) {
      await updateCultivatorStory(cultivatorId, resolved.progress, tx);
    } else {
      await insertCultivatorStory(cultivatorId, resolved.progress, tx);
    }
    return presentStory(chapter, resolved.progress, facts);
  },
};
