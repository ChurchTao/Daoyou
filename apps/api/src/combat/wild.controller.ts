import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { CombatAutoRequestSchema } from '@daoyou/contracts/combat/auto';
import {
  CombatV6TrainingCommandParamsSchema,
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
  CombatV6TrainingSessionParamsSchema,
} from '@daoyou/contracts/combat';
import {
  WildExploreRequestSchema,
  WildStartRequestSchema,
} from '@daoyou/contracts/combat/wild';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AutoErrors } from './auto-errors.js';
import { CombatErrors } from './combat-errors.js';
import { WildService } from './wild.service.js';

@Controller('api/combat-v6/wild')
@Access('active')
@UseFilters(CombatErrors)
export class WildController {
  constructor(@Inject(WildService) private readonly wild: WildService) {}

  @Get('regions/:nodeId')
  region(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
  ) {
    return this.wild.region(actor, nodeId);
  }

  @Post('explorations')
  @HttpCode(200)
  explore(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(WildExploreRequestSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof WildExploreRequestSchema>,
  ) {
    return this.wild.explore(actor, input);
  }

  @Post('sessions')
  @HttpCode(200)
  start(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(WildStartRequestSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof WildStartRequestSchema>,
  ) {
    return this.wild.start(actor, input.encounterId);
  }

  @Get('sessions/current')
  current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.wild.current(actor);
  }

  @Get('sessions/:sessionId')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingSessionParamsSchema))
    params: z.infer<typeof CombatV6TrainingSessionParamsSchema>,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.wild.read(actor, params.sessionId, query.afterEventSeq);
  }

  @Put('sessions/:sessionId/commands/:unitId')
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingCommandParamsSchema))
    params: z.infer<typeof CombatV6TrainingCommandParamsSchema>,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.wild.submit(actor, params.sessionId, params.unitId, input);
  }

  @Post('sessions/:sessionId/resolve')
  @HttpCode(200)
  resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingSessionParamsSchema))
    params: z.infer<typeof CombatV6TrainingSessionParamsSchema>,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.wild.resolve(actor, params.sessionId, input.expectedRevision);
  }

  @Post('sessions/:id/auto')
  @HttpCode(200)
  @UseFilters(AutoErrors)
  auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid(), 'legacy-unhandled')) id: string,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema, 'legacy-unhandled'))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return this.wild.resolve(actor, id, input.expectedRevision, input.round);
  }

  @Delete('sessions/:sessionId')
  abandon(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingSessionParamsSchema))
    params: z.infer<typeof CombatV6TrainingSessionParamsSchema>,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.wild.abandon(actor, params.sessionId, input.expectedRevision);
  }
}
