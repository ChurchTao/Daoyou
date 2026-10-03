import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { LegacyInventoryService } from './inventory.service.js';

const LegacyInventoryErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  console.error('Legacy inventory API error:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});

@Controller('api/cultivator/inventory')
@Access('active')
@UseFilters(LegacyInventoryErrors)
export class LegacyInventoryController {
  constructor(
    @Inject(LegacyInventoryService)
    private readonly inventory: LegacyInventoryService,
  ) {}

  @Get()
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery() query: Record<string, string | undefined>,
  ) {
    return this.inventory.list(actor, query);
  }

  @Post('discard')
  @HttpCode(200)
  discard(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody() body: unknown,
  ) {
    return this.inventory.discard(actor, body);
  }

}
