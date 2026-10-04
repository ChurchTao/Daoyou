import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from '@server/sects/organization/commandSupport.js';
import { executeSectTransfer } from '@server/sects/organization/SectTransferApplicationService.js';

export async function executeSectTransferCommand(
  args: SectCommandArgs & {
    targetSectId: string;
    reversePaths: boolean;
    consumableId?: string;
  },
) {
  return executeSectPlayerCommand(args, async (tx) => {
    const result = await executeSectTransfer({ ...args, tx });
    return {
      result: { membership: result.membership },
      resourceChanges: [
        {
          resourceTopic: 'player.sect-combat',
          operation: 'invalidate',
          eventType: 'combat_v6.sect.transferred',
        },
        {
          resourceTopic: 'player.session',
          eventType: 'sect.transferred',
          operation: 'merge',
          payload: {
            activeCultivator: {
              id: args.cultivatorId,
              status: 'active',
              sectId: result.membership.sectId,
            },
          },
        },
        {
          resourceTopic: 'sect.membership',
          eventType: 'sect.transferred',
          operation: 'replace',
          payload: result.membership,
        },
        {
          resourceTopic: 'inventory.consumables',
          eventType: 'inventory.sect_transfer.used',
          operation: 'invalidate',
        },
        {
          scope: { kind: 'sect', id: result.sourceSectId },
          resourceTopic: 'sect.members',
          eventType: 'sect.member_transferred',
          operation: 'invalidate',
        },
        {
          scope: { kind: 'sect', id: result.membership.sectId },
          resourceTopic: 'sect.members',
          eventType: 'sect.member_transferred',
          operation: 'invalidate',
        },
        {
          resourceTopic: 'sect.tasks',
          eventType: 'sect.transferred',
          operation: 'invalidate',
        },
      ] satisfies ResourceChangeDescriptor[],
    };
  });
}
