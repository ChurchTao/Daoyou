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
import { ReputationShopError } from '@server/reputation-shop/application/ReputationShopService.js';
import {
  ReputationShopBuyBodySchema,
  ReputationShopBuyParamsSchema,
} from '@daoyou/contracts/shops/reputation';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ReputationShopService } from './reputation-shop.service.js';

const ReputationBuyErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (
    error instanceof ReputationShopError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: '参数错误', details: error.flatten() },
      { status: 400 },
    );
  console.error('reputation shop buy error:', error);
  return Response.json({ error: '兑换失败，请稍后再试' }, { status: 500 });
});

@Controller('api/reputation-shop')
@Access('active')
export class ReputationShopController {
  constructor(
    @Inject(ReputationShopService) private readonly shop: ReputationShopService,
  ) {}

  @Get()
  list(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.shop.list(actor.cultivatorId);
  }

  @Post(':id/buy')
  @HttpCode(200)
  @UseFilters(ReputationBuyErrors)
  buy(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(ReputationShopBuyParamsSchema))
    params: z.infer<typeof ReputationShopBuyParamsSchema>,
    @JsonBody(new ZodPipe(ReputationShopBuyBodySchema))
    input: z.infer<typeof ReputationShopBuyBodySchema>,
  ) {
    return this.shop.buy(actor, params.id, input.requestId);
  }
}
