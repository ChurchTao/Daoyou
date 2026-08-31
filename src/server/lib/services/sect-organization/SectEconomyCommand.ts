import { loadSectCultivatorProgress } from '@server/lib/repositories/sectRepository';
import { sectOrganizationFacade } from '.';
import { SectError } from '../SectError';
import { createPostgresSectEconomyContext } from './PostgresSectOrganizationAdapters';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from './commandSupport';

export function executeSectShopPurchaseCommand(
  args: SectCommandArgs & { itemId: string },
) {
  return executeSectPlayerCommand(args, (tx) =>
    sectOrganizationFacade.economy.purchaseShopItem(
      args.userId,
      args.cultivatorId,
      args.itemId,
      createPostgresSectEconomyContext({
        q: tx,
        runtime: args.runtime,
        userId: args.userId,
      }),
    ),
  );
}

export function executeSectStipendClaimCommand(args: SectCommandArgs) {
  return executeSectPlayerCommand(args, async (tx) => {
    const cultivator = await loadSectCultivatorProgress(args.cultivatorId, tx);
    if (!cultivator)
      throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
    return sectOrganizationFacade.economy.claimStipend(
      { id: args.cultivatorId, realm: cultivator.realm },
      createPostgresSectEconomyContext({
        q: tx,
        runtime: args.runtime,
        userId: args.userId,
      }),
    );
  });
}
