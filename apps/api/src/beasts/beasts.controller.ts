import { BeastAllocateSchema } from './beasts-input.js';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { BeastError } from '@server/combat/application/CombatV6BeastService.js';
import {
  BeastClaimSchema,
  BeastFusionRequestSchema,
  BeastLineupRequestSchema,
  BeastRenameSchema,
  BeastRestSchema,
} from '@daoyou/contracts/beasts';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { CombatErrors, combatErrorResponse } from '../combat/combat-errors.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { BeastsService } from './beasts.service.js';

const FusionErrors = apiErrorFilter((error) => {
  if (error instanceof BeastError)
    return Response.json(
      { success: false, error: error.message, code: 'BEAST_FUSION_REJECTED' },
      { status: 409 },
    );
  return combatErrorResponse(error);
});

@Controller('api/combat-v6/beasts')
@Access('active')
@UseFilters(CombatErrors)
export class BeastsController {
  constructor(@Inject(BeastsService) private readonly beasts: BeastsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.beasts.read(actor.cultivatorId);
  }

  @Get('fusions/:requestId')
  @Header('Cache-Control', 'no-store')
  fusion(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('requestId', new ZodPipe(z.uuid())) requestId: string,
  ) {
    return this.beasts.fusion(actor.cultivatorId, requestId);
  }

  @Post('fuse')
  @HttpCode(200)
  @UseFilters(FusionErrors)
  fuse(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(BeastFusionRequestSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof BeastFusionRequestSchema>,
  ) {
    return this.beasts.fuse(actor.cultivatorId, input);
  }

  @Post('claim')
  @HttpCode(200)
  claim(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(BeastClaimSchema))
    input: z.infer<typeof BeastClaimSchema>,
  ) {
    return this.beasts.claim(actor.cultivatorId, input.speciesId);
  }

  @Put('lineup')
  lineup(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(BeastLineupRequestSchema))
    input: z.infer<typeof BeastLineupRequestSchema>,
  ) {
    return this.beasts.lineup(actor.cultivatorId, input);
  }

  @Post('rest')
  @HttpCode(200)
  rest(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(BeastRestSchema))
    input: z.infer<typeof BeastRestSchema>,
  ) {
    return this.beasts.rest(actor.cultivatorId, input);
  }

  @Post('allocate')
  @HttpCode(200)
  allocate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(BeastAllocateSchema))
    input: z.infer<typeof BeastAllocateSchema>,
  ) {
    return this.beasts.allocate(actor.cultivatorId, input);
  }

  @Post('rename')
  @HttpCode(200)
  rename(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(BeastRenameSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof BeastRenameSchema>,
  ) {
    return this.beasts.rename(actor.cultivatorId, input);
  }

  @Post('release')
  @HttpCode(200)
  release(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(BeastRestSchema))
    input: z.infer<typeof BeastRestSchema>,
  ) {
    return this.beasts.release(actor.cultivatorId, input);
  }
}
