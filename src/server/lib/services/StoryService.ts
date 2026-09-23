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
} from '@shared/story/resolve';
import { emptyStoryFacts, type StoryView } from '@shared/story/schema';

const MAIN_STORY_ID = 'arrival';

export const StoryService = {
  async read(cultivatorId: string, tx: DbTransaction): Promise<StoryView> {
    const progress =
      (await findCultivatorStory(cultivatorId, 'main', MAIN_STORY_ID, tx)) ??
      restingStoryProgress();
    return presentStory(
      getStoryChapter(progress.storyId),
      progress,
      emptyStoryFacts(),
    );
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
    const progress = stored ?? restingStoryProgress();
    const chapter = getStoryChapter(progress.storyId);
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
