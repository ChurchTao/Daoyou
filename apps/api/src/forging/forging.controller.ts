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
  ForgeRequestSchema,
  VaultQuerySchema,
  WithdrawMaterialSchema,
  WithdrawVaultPageSchema,
} from '@daoyou/contracts/forging';
import { InventoryRuleError } from '@daoyou/game-domain/inventory';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ForgingService } from './forging.service.js';

const ForgingErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '请求参数或材料数据无效' },
      { status: 400 },
    );
  if (
    error instanceof InventoryError ||
    error instanceof InventoryRuleError ||
    error instanceof QiServiceError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  console.error('[forging] request failed', error);
  return Response.json(
    { success: false, error: '请求未完成，请核对物品状态后重试' },
    { status: 500 },
  );
});

@Controller('api/combat-v6/forging')
@Access('active')
@UseFilters(ForgingErrors)
export class ForgingController {
  constructor(
    @Inject(ForgingService) private readonly forging: ForgingService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.forging.read(actor.cultivatorId);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  forge(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ForgeRequestSchema))
    input: z.infer<typeof ForgeRequestSchema>,
  ) {
    return this.forging.forge(actor, input);
  }

  @Get('vault')
  @Header('Cache-Control', 'no-store')
  vault(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(VaultQuerySchema))
    query: z.infer<typeof VaultQuerySchema>,
  ) {
    return this.forging.vault(actor.cultivatorId, query);
  }

  @Post('vault/withdraw')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  withdraw(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(WithdrawMaterialSchema))
    input: z.infer<typeof WithdrawMaterialSchema>,
  ) {
    return this.forging.withdraw(actor.cultivatorId, input);
  }

  @Post('vault/withdraw-page')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  withdrawPage(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(WithdrawVaultPageSchema))
    input: z.infer<typeof WithdrawVaultPageSchema>,
  ) {
    return this.forging.withdrawPage(actor.cultivatorId, input);
  }
}
