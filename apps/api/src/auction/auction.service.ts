import type {
  AuctionBeastListRequest,
  AuctionBuySchema,
  AuctionListRequest,
} from '@daoyou/contracts/auction';
import { Inject, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
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
  ) {}

  async listings(owner: string, params: z.infer<typeof ListingsSchema>) {
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
    return toPlayerStateMutationResponse(
      await this.application.buyAuctionListing({ actor, ...input }),
    );
  }

  async list(actor: ActiveCultivatorRef, input: AuctionListRequest) {
    return toPlayerStateMutationResponse(
      await this.application.listAuctionItem({ actor, ...input }),
    );
  }

  async listBeast(actor: ActiveCultivatorRef, input: AuctionBeastListRequest) {
    return toPlayerStateMutationResponse(
      await this.application.listAuctionBeast({ actor, ...input }),
    );
  }

  async cancel(actor: ActiveCultivatorRef, listingId: string) {
    return toPlayerStateMutationResponse(
      await this.application.cancelAuctionListing({ actor, listingId }),
    );
  }
}
