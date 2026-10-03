import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { MarketRecycleError } from '@server/inventory/recycle-errors.js';
import { MarketServiceError } from '@server/market/application/MarketService.js';
import { MarketBuySchema } from '@daoyou/shared/contracts/market';
import { RecycleRequestSchema } from '@daoyou/shared/contracts/recycle';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { MarketService } from './market.service.js';

const RecycleErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message ?? '参数格式错误' },
      { status: 400 },
    );
  if (error instanceof MarketRecycleError)
    return Response.json({ error: error.message }, { status: error.status });
  return undefined;
});
const MarketReadErrors = apiErrorFilter((error) => {
  if (error instanceof MarketServiceError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error('Market node API error:', error);
  return Response.json(
    { error: 'Failed to fetch market listings' },
    { status: 500 },
  );
});
const MarketBuyErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (
    error instanceof MarketServiceError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || '参数错误' },
      { status: 400 },
    );
  console.error('Market buy API error:', error);
  return Response.json({ error: '购买失败' }, { status: 500 });
});

@Controller('api/market')
@Access('active')
export class MarketController {
  constructor(@Inject(MarketService) private readonly market: MarketService) {}

  @Post('recycle')
  @HttpCode(200)
  @UseFilters(RecycleErrors)
  recycle(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(RecycleRequestSchema))
    input: z.infer<typeof RecycleRequestSchema>,
  ) {
    return this.market.recycle(actor, input);
  }

  @Get(':nodeId')
  @UseFilters(MarketReadErrors)
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
    @FirstQuery('layer') layer?: string,
  ) {
    return this.market.list(actor, nodeId, layer);
  }

  @Post(':nodeId/buy')
  @HttpCode(200)
  @UseFilters(MarketBuyErrors)
  buy(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
    @JsonBody(new ZodPipe(MarketBuySchema))
    input: z.infer<typeof MarketBuySchema>,
  ) {
    return this.market.buy(actor, nodeId, input);
  }
}
