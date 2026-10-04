import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  AuctionBeastListSchema,
  AuctionBuySchema,
  AuctionListSchema,
} from '@daoyou/contracts/auction';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AuctionListingsErrors, auctionMutationErrors } from './auction-errors.js';
import { ListingsSchema } from './auction-input.js';
import { AuctionService } from './auction.service.js';

@Controller('api/auction')
@Access('active')
export class AuctionController {
  constructor(
    @Inject(AuctionService) private readonly auction: AuctionService,
  ) {}

  @Get('listings')
  @UseFilters(AuctionListingsErrors)
  listings(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    const params = ListingsSchema.parse({
      scope: query.scope || undefined,
      assetType: query.assetType || undefined,
      itemType: query.itemType || undefined,
      itemCategory: query.itemCategory || undefined,
      itemQuality: query.itemQuality || undefined,
      itemName: query.itemName || undefined,
      sellerName: query.sellerName || undefined,
      minPrice: query.minPrice ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
      sortBy: query.sortBy || undefined,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return this.auction.listings(actor.cultivatorId, params);
  }

  @Post('buy')
  @HttpCode(200)
  @UseFilters(auctionMutationErrors('buy'))
  buy(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(AuctionBuySchema))
    input: z.infer<typeof AuctionBuySchema>,
  ) {
    return this.auction.buy(actor, input);
  }

  @Post('list')
  @HttpCode(200)
  @UseFilters(auctionMutationErrors('list'))
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }) body: unknown,
  ) {
    const request = AuctionListSchema.safeParse(body);
    if (!request.success)
      throw new HttpException(
        { error: '参数错误', details: request.error.issues },
        400,
      );
    return this.auction.list(actor, request.data);
  }

  @Post('list-beast')
  @HttpCode(200)
  @UseFilters(auctionMutationErrors('list-beast'))
  listBeast(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }) body: unknown,
  ) {
    const request = AuctionBeastListSchema.safeParse(body);
    if (!request.success)
      throw new HttpException(
        { error: '参数错误', details: request.error.issues },
        400,
      );
    return this.auction.listBeast(actor, request.data);
  }

  @Delete(':id')
  @UseFilters(auctionMutationErrors('cancel'))
  cancel(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success)
      throw new HttpException({ error: '货单标识无效' }, 400);
    return this.auction.cancel(actor, parsed.data);
  }
}
