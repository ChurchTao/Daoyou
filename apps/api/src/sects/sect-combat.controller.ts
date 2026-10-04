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
import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import {
  SectPathSelectionRequestSchema,
  type SectPathSelectionRequest,
} from '@daoyou/contracts/combat';
import { SectV6ActionSchema } from '@daoyou/game-domain/sects/commands';
import { SectV6RuleError } from '@daoyou/game-rules/sects';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { CombatErrors } from '../combat/combat-errors.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SectCombatService } from './sect-combat.service.js';

const ProgressionErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '参数无效' },
      { status: 400 },
    );
  if (
    error instanceof InventoryError ||
    error instanceof SectV6RuleError ||
    error instanceof CombatV6BuildError
  )
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  console.error('[sect-v6]', error);
  return Response.json(
    { success: false, error: '请求未完成，请刷新核对传承与资源' },
    { status: 500 },
  );
});

@Controller('api/combat-v6/sect')
@Access('active')
export class SectCombatController {
  constructor(
    @Inject(SectCombatService) private readonly sect: SectCombatService,
  ) {}

  @Get('state')
  @UseFilters(CombatErrors)
  state(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.sect.state(actor.cultivatorId);
  }

  @Post('path')
  @HttpCode(200)
  @UseFilters(CombatErrors)
  selectPath(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(SectPathSelectionRequestSchema))
    input: SectPathSelectionRequest,
  ) {
    return this.sect.selectPath(actor, input);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @UseFilters(ProgressionErrors)
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.sect.read(actor.cultivatorId);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseFilters(ProgressionErrors)
  mutate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(SectV6ActionSchema))
    action: z.infer<typeof SectV6ActionSchema>,
  ) {
    return this.sect.mutate(actor.cultivatorId, action);
  }
}
