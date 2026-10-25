import type {
  AuctionBeastListRequest,
  AuctionBuyOrderCreateRequest,
  AuctionBuyOrderSupplyRequest,
  AuctionBuySchema,
  AuctionListRequest,
} from '@daoyou/contracts/auction';
import { LATE_QI_AUCTION_DENIED } from '@daoyou/game-rules/progression/realm-access';
import { Inject, Injectable } from '@nestjs/common';
import { assertLateQiRefining } from '@server/cultivator/application/lateQiAccess.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type { z } from 'zod';
import { AuctionApplicationService } from './application/AuctionApplicationService.js';
import { AuctionBuyOrderOperations } from './application/AuctionBuyOrderService.js';
import {
  AuctionOperations,
  publicAuctionListing,
} from './application/AuctionService.js';
import type { BuyOrdersSchema, ListingsSchema } from './auction-input.js';

@Injectable()
export class AuctionService {
  constructor(
    @Inject(AuctionApplicationService)
    private readonly application: AuctionApplicationService,
    @Inject(AuctionOperations) private readonly operations: AuctionOperations,
    @Inject(AuctionBuyOrderOperations)
    private readonly buyOrderOperations: AuctionBuyOrderOperations,
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
  ) {}

  private assertRealm(cultivatorId: string) {
    return assertLateQiRefining(
      cultivatorId,
      LATE_QI_AUCTION_DENIED,
      this.database,
    );
  }

  async listings(owner: string, params: z.infer<typeof ListingsSchema>) {
    await this.assertRealm(owner);
    if (params.assetType === 'beast' || params.itemType === 'beast')
      params.itemQuality = undefined;
    const result = await this.operations.listings({
      ...params,
      viewerCultivatorId: owner,
    });
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(result.total / limit);
    const slots =
      params.scope === 'mine'
        ? await this.operations.listingSlots(owner)
        : undefined;
    return {
      listings: result.listings.map(publicAuctionListing),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
      ...(slots ? { slots } : {}),
    };
  }

  async buy(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof AuctionBuySchema>,
  ) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.buyAuctionListing({ actor, ...input }),
    );
  }

  async list(actor: ActiveCultivatorRef, input: AuctionListRequest) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.listAuctionItem({ actor, ...input }),
    );
  }

  async listBeast(actor: ActiveCultivatorRef, input: AuctionBeastListRequest) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.listAuctionBeast({ actor, ...input }),
    );
  }

  async cancel(actor: ActiveCultivatorRef, listingId: string) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.cancelAuctionListing({ actor, listingId }),
    );
  }

  async buyOrders(
    owner: string,
    params: z.infer<typeof BuyOrdersSchema>,
  ) {
    await this.assertRealm(owner);
    return this.buyOrderOperations.listBuyOrders(owner, params);
  }

  async createBuyOrder(
    actor: ActiveCultivatorRef,
    input: AuctionBuyOrderCreateRequest,
  ) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.createAuctionBuyOrder({ actor, ...input }),
    );
  }

  async supplyBuyOrder(
    actor: ActiveCultivatorRef,
    buyOrderId: string,
    input: AuctionBuyOrderSupplyRequest,
  ) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.supplyAuctionBuyOrder({
        actor,
        buyOrderId,
        ...input,
      }),
    );
  }

  async cancelBuyOrder(actor: ActiveCultivatorRef, buyOrderId: string) {
    await this.assertRealm(actor.cultivatorId);
    return toPlayerStateMutationResponse(
      await this.application.cancelAuctionBuyOrder({ actor, buyOrderId }),
    );
  }
}
