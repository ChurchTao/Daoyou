import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { readCultivatorReputation } from '@server/cultivator/facts.js';
import {
  purchaseReputationShopCartCommand,
  purchaseReputationShopItemCommand,
} from '@server/reputation-shop/application/ReputationShopApplicationService.js';
import { listReputationShopItems } from '@server/reputation-shop/application/ReputationShopService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';

@Injectable()
export class ReputationShopService {
  async list(owner: string) {
    const items = await listReputationShopItems({
      cultivatorId: owner,
      userVisibleOnly: true,
    });
    const { reputation } = await readCultivatorReputation(owner);
    return { items, reputation };
  }

  async buy(actor: ActiveCultivatorRef, id: string, requestId: string) {
    return toPlayerStateMutationResponse(
      await purchaseReputationShopItemCommand({
        id,
        requestId,
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
      }),
    );
  }

  async buyCart(
    actor: ActiveCultivatorRef,
    input: {
      requestId: string;
      expectedTotal: number;
      items: Array<{ id: string; count: number }>;
    },
  ) {
    return toPlayerStateMutationResponse(
      await purchaseReputationShopCartCommand({
        lines: input.items,
        expectedTotal: input.expectedTotal,
        requestId: input.requestId,
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
      }),
    );
  }
}
