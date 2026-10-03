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
import { InventoryError } from '@server/inventory/operations.js';
import { ManualActionSchema } from '@daoyou/shared/contracts/combatV6Manuals';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ManualsService } from './manuals.service.js';

const ManualErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '请求参数无效' },
      { status: 400 },
    );
  if (error instanceof InventoryError)
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  console.error('[manuals] request failed', error);
  return Response.json(
    { success: false, error: '请求未完成，请刷新核对道印与玉简' },
    { status: 500 },
  );
});

@Controller('api/combat-v6/manuals')
@Access('active')
@UseFilters(ManualErrors)
export class ManualsController {
  constructor(
    @Inject(ManualsService) private readonly manuals: ManualsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.manuals.read(actor.cultivatorId);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  mutate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ManualActionSchema))
    action: z.infer<typeof ManualActionSchema>,
  ) {
    return this.manuals.mutate(actor.cultivatorId, action);
  }
}
