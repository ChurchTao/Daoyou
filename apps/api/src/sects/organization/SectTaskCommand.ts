import { StoryService } from '@server/story/application/StoryService.js';
import { sectOrganizationFacade } from '@server/sects/organization/index.js';
import { createPostgresSectCommandContext } from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from '@server/sects/organization/commandSupport.js';

export function executeSectTaskActionCommand(
  args: SectCommandArgs & {
    taskId: string;
    actionKey: string;
    requestId: string;
    input: Record<string, unknown>;
  },
) {
  return executeSectPlayerCommand(args, async (tx) => {
    const acted = await sectOrganizationFacade.tasks.actions.execute(
      {
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        taskId: args.taskId,
        actionKey: args.actionKey,
        requestId: args.requestId,
        input: args.input,
      },
      createPostgresSectCommandContext({
        tx,
        runtime: args.runtime,
        userId: args.userId,
      }),
    );
    // 主线里有「做几次宗门日常」的目标，差事有了结果就让故事跟上。
    const story = await StoryService.reconcile(args.cultivatorId, tx);
    return {
      ...acted,
      resourceChanges: [...acted.resourceChanges, ...(story?.changes ?? [])],
    };
  });
}
