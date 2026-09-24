import type { StoryView } from '@shared/story/schema';
import { playerCommandExecutor } from './CommandExecutors';
import { StoryService } from './StoryService';

export function completeStoryPerformanceCommand(args: {
  userId: string;
  cultivatorId: string;
  scriptId: string;
  outcome: string;
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'story_performance_complete',
    command: async (tx) => {
      const settled = await StoryService.completePerformance(
        args.cultivatorId,
        args.scriptId,
        args.outcome,
        tx,
      );
      return {
        result: settled.view,
        resourceChanges: settled.changes,
      };
    },
  });
}

export function completeStoryGuideCommand(args: {
  userId: string;
  cultivatorId: string;
  lessonId: string;
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'story_guide_complete',
    command: async (tx) => {
      const settled = await StoryService.completeGuide(
        args.cultivatorId,
        args.lessonId,
        tx,
      );
      return {
        result: settled.view,
        resourceChanges: settled.changes,
      };
    },
  });
}

export type CompletedStoryPerformance = StoryView;
