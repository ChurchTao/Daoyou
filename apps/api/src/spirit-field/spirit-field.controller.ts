import {
  SpiritFieldArchiveRequestSchema,
  SpiritFieldBranchRequestSchema,
  SpiritFieldEvolveRequestSchema,
  SpiritFieldExchangeRequestSchema,
  SpiritFieldHarvestRequestSchema,
  SpiritFieldRestoreRequestSchema,
  SpiritFieldRetireRequestSchema,
  SpiritFieldSowRequestSchema,
  SpiritFieldStarterRequestSchema,
} from '@daoyou/contracts/spirit-field';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import { InventoryError } from '@server/inventory/operations.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SpiritFieldServiceError } from './application/SpiritFieldError.js';
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
  starter(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldStarterRequestSchema))
    input: z.infer<typeof SpiritFieldStarterRequestSchema>,
  ) {
    return this.field.starter(actor, input);
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

  @Post('harvest')
  @HttpCode(200)
  harvest(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldHarvestRequestSchema))
    input: z.infer<typeof SpiritFieldHarvestRequestSchema>,
  ) {
    return this.field.harvest(actor, input);
  }

  @Post('branch')
  @HttpCode(200)
  branch(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldBranchRequestSchema))
    input: z.infer<typeof SpiritFieldBranchRequestSchema>,
  ) {
    return this.field.branch(actor, input);
  }

  @Post('evolve')
  @HttpCode(200)
  evolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldEvolveRequestSchema))
    input: z.infer<typeof SpiritFieldEvolveRequestSchema>,
  ) {
    return this.field.evolve(actor, input);
  }

  @Post('archive')
  @HttpCode(200)
  archive(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldArchiveRequestSchema))
    input: z.infer<typeof SpiritFieldArchiveRequestSchema>,
  ) {
    return this.field.archive(actor, input);
  }

  @Post('restore')
  @HttpCode(200)
  restore(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldRestoreRequestSchema))
    input: z.infer<typeof SpiritFieldRestoreRequestSchema>,
  ) {
    return this.field.restore(actor, input);
  }

  @Post('retire')
  @HttpCode(200)
  retire(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldRetireRequestSchema))
    input: z.infer<typeof SpiritFieldRetireRequestSchema>,
  ) {
    return this.field.retire(actor, input);
  }

  @Post('exchange')
  @HttpCode(200)
  exchange(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SpiritFieldExchangeRequestSchema))
    input: z.infer<typeof SpiritFieldExchangeRequestSchema>,
  ) {
    return this.field.exchange(actor, input);
  }
}
