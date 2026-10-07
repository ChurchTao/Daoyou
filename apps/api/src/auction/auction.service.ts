import type {
  AuctionBeastListRequest,
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
import {
  AuctionOperations,
  publicAuctionListing,
} from './application/AuctionService.js';
import type { ListingsSchema } from './auction-input.js';

@Injectable()
export class AuctionService {
  constructor(
    @Inject(AuctionApplicationService)
    private readonly application: AuctionApplicationService,
    @Inject(AuctionOperations) private readonly operations: AuctionOperations,
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
    return {
      listings: result.listings.map(publicAuctionListing),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
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
}
