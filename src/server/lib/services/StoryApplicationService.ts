import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
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
      const view = await StoryService.completePerformance(
        args.cultivatorId,
        args.scriptId,
        args.outcome,
        tx,
      );
      return {
        result: view,
        resourceChanges: [
          {
            resourceTopic: 'player.story',
            eventType: 'story.performance_completed',
            operation: 'replace',
            payload: view,
          },
        ] satisfies ResourceChangeDescriptor[],
      };
    },
  });
}

export type CompletedStoryPerformance = StoryView;
