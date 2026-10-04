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
  return executeSectPlayerCommand(args, (tx) =>
    sectOrganizationFacade.tasks.actions.execute(
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
    ),
  );
}
