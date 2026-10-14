import {
  WandererBeastSaleSchema,
  WandererPurchaseSchema,
  type WandererBeastSale,
  type WandererPurchase,
} from '@daoyou/contracts/wanderer';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import { BeastError } from '@server/combat/application/BeastMutationGuard.js';
import { InventoryError } from '@server/inventory/operations.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { WandererError } from './application/WandererTradeService.js';
import { WandererService } from './wanderer.service.js';

const WandererErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (
    error instanceof WandererError ||
    error instanceof BeastError ||
    error instanceof InventoryError ||
    error instanceof PlayerCommandIdempotencyError
  ) {
    const status =
      error instanceof WandererError
        ? error.status
        : error instanceof PlayerCommandIdempotencyError
          ? error.status
          : error instanceof BeastError
            ? error.status
            : 400;
    return Response.json(
      { success: false, error: error.message },
      { status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '未能完成交易，请刷新后再试' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  console.error('[wanderer] request failed', error);
  return Response.json(
    { success: false, error: '云游商人暂时不方便交易，请稍后再试' },
    { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
  );
});

@Controller('api/wanderer')
@Access('active')
@UseFilters(WandererErrors)
export class WandererController {
  constructor(
    @Inject(WandererService) private readonly wanderer: WandererService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  state() {
    return this.wanderer.state();
  }

  @Get('beasts')
  @Header('Cache-Control', 'private, no-store')
  beasts(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.wanderer.beasts(actor);
  }

  @Post('beasts')
  @HttpCode(200)
  sellBeast(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(WandererBeastSaleSchema)) input: WandererBeastSale,
  ) {
    return this.wanderer.sellBeast(actor, input);
  }

  @Post('book')
  @HttpCode(200)
  buyBook(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(WandererPurchaseSchema)) input: WandererPurchase,
  ) {
    return this.wanderer.buyBook(actor, input);
  }

  @Post('dew')
  @HttpCode(200)
  buyDew(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(WandererPurchaseSchema)) input: WandererPurchase,
  ) {
    return this.wanderer.buyDew(actor, input);
  }
}
