import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from './commandSupport';
import { executeSectTransfer } from './SectTransferApplicationService';

export function executeSectTransferCommand(
  args: SectCommandArgs & {
    targetSectId: string;
    reversePaths: boolean;
    consumableId?: string;
  },
) {
  return executeSectPlayerCommand(args, async (tx) => {
    const result = await executeSectTransfer({ ...args, tx });
    return {
      result: { sect: result.sect },
      resourceChanges: [
        {
          resourceTopic: 'player.session',
          eventType: 'sect.transferred',
          operation: 'merge',
          payload: {
            activeCultivator: {
              id: args.cultivatorId,
              status: 'active',
              sectId: result.sect.sectId,
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
          resourceTopic: 'sect.progression',
          eventType: 'sect.transferred',
          operation: 'replace',
          payload: {
            activePathId: result.sect.activePathId,
            methods: result.sect.methods,
            paths: result.sect.paths,
            abilityLoadout: result.sect.abilityLoadout,
          },
        },
        result.remainingTalisman
          ? {
              resourceTopic: 'inventory.consumables',
              eventType: 'inventory.sect_transfer.used',
              operation: 'upsert-items',
              payload: { idKey: 'id', items: [result.remainingTalisman] },
            }
          : {
              resourceTopic: 'inventory.consumables',
              eventType: 'inventory.sect_transfer.used',
              operation: 'remove-items',
              payload: { idKey: 'id', ids: [result.consumedTalismanId] },
            },
        {
          scope: { kind: 'sect', id: result.sourceSectId },
          resourceTopic: 'sect.members',
          eventType: 'sect.member_transferred',
          operation: 'invalidate',
        },
        {
          scope: { kind: 'sect', id: result.sect.sectId },
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
