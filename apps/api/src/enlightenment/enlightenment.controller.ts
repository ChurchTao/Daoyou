import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { InventoryError } from '@server/inventory/operations.js';
import { QiServiceError } from '@server/cultivator/application/QiService.js';
import {
  EnlightenmentRequestSchema,
  type EnlightenmentRequest,
} from '@daoyou/contracts/enlightenment';
import { InventoryRuleError } from '@daoyou/game-domain/inventory';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { EnlightenmentService } from './enlightenment.service.js';

const EnlightenmentErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '典籍参数无效' },
      { status: 400 },
    );
  if (
    error instanceof InventoryError ||
    error instanceof InventoryRuleError ||
    error instanceof QiServiceError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json(
      { success: false, code: 'ENLIGHTENMENT_REJECTED', error: error.message },
      { status: 409 },
    );
  console.error('[enlightenment] request failed', error);
  return Response.json(
    { success: false, error: '参悟结果暂未确认，请重试核对本次结果' },
    { status: 500 },
  );
});

@Controller('api/combat-v6/enlightenment')
@Access('active')
@UseFilters(EnlightenmentErrors)
export class EnlightenmentController {
  constructor(
    @Inject(EnlightenmentService)
    private readonly service: EnlightenmentService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.service.read(actor);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  mutate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(EnlightenmentRequestSchema))
    input: EnlightenmentRequest,
  ) {
    return this.service.mutate(actor, input);
  }
}
