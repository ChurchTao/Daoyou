import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { InventoryError } from '@server/inventory/operations.js';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/cultivator/application/QiService.js';
import { SpiritFieldServiceError } from '@server/spirit-field/application/SpiritFieldError.js';
import {
  SpiritFieldCultivateRequestSchema,
  SpiritFieldHarvestRequestSchema,
  SpiritFieldSowRequestSchema,
} from '@daoyou/shared/contracts/spiritField';
import type { Response as ExpressResponse } from 'express';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { withRequestAbort } from '../http/request-abort.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SpiritFieldService } from './spirit-field.service.js';

const SpiritFieldErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (
    error instanceof InventoryError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        success: false,
        error: error.issues[0]?.message || '参数错误',
        details: error.issues,
      },
      { status: 400 },
    );
  if (error instanceof SpiritFieldServiceError)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  if (error instanceof QiInsufficientError)
    return Response.json(
      {
        success: false,
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      { status: 409 },
    );
  if (error instanceof QiServiceError)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  console.error('spirit field api error:', error);
  return Response.json(
    { success: false, error: '灵田灵机暂乱，请稍后再试' },
    { status: 500 },
  );
});

@Controller('api/spirit-field')
@Access('active')
@UseFilters(SpiritFieldErrors)
export class SpiritFieldController {
  constructor(
    @Inject(SpiritFieldService) private readonly field: SpiritFieldService,
  ) {}

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.field.read(actor);
  }

  @Post('starter')
  @HttpCode(200)
  starter(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.field.starter(actor);
  }

  @Post('sow')
  @HttpCode(200)
  sow(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldSowRequestSchema))
    input: z.infer<typeof SpiritFieldSowRequestSchema>,
  ) {
    return this.field.sow(actor, input);
  }

  @Post('cultivate')
  @HttpCode(200)
  cultivate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldCultivateRequestSchema))
    input: z.infer<typeof SpiritFieldCultivateRequestSchema>,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    return withRequestAbort(response, (signal) =>
      this.field.cultivate(actor, input, signal),
    );
  }

  @Post('harvest')
  @HttpCode(200)
  harvest(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldHarvestRequestSchema))
    input: z.infer<typeof SpiritFieldHarvestRequestSchema>,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    return withRequestAbort(response, (signal) =>
      this.field.harvest(actor, input, signal),
    );
  }
}
