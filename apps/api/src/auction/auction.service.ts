import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import * as auctionRepository from '@server/lib/repositories/auctionRepository.js';
import {
  buyAuctionListing,
  cancelAuctionListing,
  listAuctionBeast,
  listAuctionItem,
} from '@server/auction/application/AuctionApplicationService.js';
import { publicAuctionListing } from '@server/auction/application/AuctionService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type {
  AuctionBeastListRequest,
  AuctionBuySchema,
  AuctionListRequest,
} from '@daoyou/shared/contracts/auction';
import type { z } from 'zod';
import type { ListingsSchema } from './auction-input.js';

@Injectable()
export class AuctionService {
  async listings(owner: string, params: z.infer<typeof ListingsSchema>) {
    if (params.assetType === 'beast' || params.itemType === 'beast')
      params.itemQuality = undefined;
    const result = await auctionRepository.findActiveListings({
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
      await buyAuctionListing({ actor, ...input }),
    );
  }

  async list(actor: ActiveCultivatorRef, input: AuctionListRequest) {
    return toPlayerStateMutationResponse(
      await listAuctionItem({ actor, ...input }),
    );
  }

  async listBeast(actor: ActiveCultivatorRef, input: AuctionBeastListRequest) {
    return toPlayerStateMutationResponse(
      await listAuctionBeast({ actor, ...input }),
    );
  }

  async cancel(actor: ActiveCultivatorRef, listingId: string) {
    return toPlayerStateMutationResponse(
      await cancelAuctionListing({ actor, listingId }),
    );
  }
}
