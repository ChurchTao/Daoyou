import { loadSectCultivatorProgress } from '@server/lib/repositories/sectRepository.js';
import { sectOrganizationFacade } from '@server/sects/organization/index.js';
import { SectError } from '@server/sects/application/SectError.js';
import { createPostgresSectEconomyContext } from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import {
  executeSectPlayerCommand,
  type SectCommandArgs,
} from '@server/sects/organization/commandSupport.js';

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
