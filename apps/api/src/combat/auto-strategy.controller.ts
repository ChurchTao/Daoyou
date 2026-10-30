import {
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { AutoStrategyError } from '@server/combat/application/CombatV6AutoStrategyService.js';
import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import {
  AutoStrategySlotIndexSchema,
  SaveAutoStrategySchema,
} from '@daoyou/game-domain/combat/auto';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AutoStrategyService } from './auto-strategy.service.js';

const pathId = z.string().min(1).max(160);
const MutationSchema = z.union([
  z.strictObject({
    pathId,
    slot: AutoStrategySlotIndexSchema,
    strategy: SaveAutoStrategySchema,
  }),
  z.strictObject({
    pathId,
    strategy: SaveAutoStrategySchema,
  }),
  z.strictObject({
    pathId,
    slot: AutoStrategySlotIndexSchema,
    activate: z.literal(true),
  }),
]);
const ResetSchema = z.union([
  z.strictObject({ pathId, slot: AutoStrategySlotIndexSchema }),
  z.strictObject({ pathId }),
]);
const StrategyErrors = apiErrorFilter((error) => {
  if (error instanceof AutoStrategyError || error instanceof CombatV6BuildError)
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '策略格式无效' },
      { status: 400 },
    );
  console.error('[combat-auto-strategy]', error);
  return Response.json(
    { success: false, error: '策略操作失败，请稍后重试' },
    { status: 500 },
  );
});

@Controller('api/combat-v6/auto-strategy')
@Access('active')
@UseFilters(StrategyErrors)
export class AutoStrategyController {
  constructor(
    @Inject(AutoStrategyService)
    private readonly strategies: AutoStrategyService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.strategies.read(actor.cultivatorId);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  save(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(MutationSchema))
    input: z.infer<typeof MutationSchema>,
  ) {
    if ('activate' in input)
      return this.strategies.activate(
        actor.cultivatorId,
        input.pathId,
        input.slot,
      );
    return this.strategies.save(
      actor.cultivatorId,
      input.pathId,
      'slot' in input ? input.slot : undefined,
      input.strategy,
    );
  }

  @Delete()
  @Header('Cache-Control', 'no-store')
  reset(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(ResetSchema))
    input: z.infer<typeof ResetSchema>,
  ) {
    if ('slot' in input)
      return this.strategies.removeSlot(
        actor.cultivatorId,
        input.pathId,
        input.slot,
      );
    return this.strategies.reset(actor.cultivatorId, input.pathId);
  }
}
