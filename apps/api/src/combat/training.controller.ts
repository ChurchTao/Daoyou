import { CombatAutoRequestSchema } from '@daoyou/contracts/combat/auto';
import {
  CombatV6TrainingCommandParamsSchema,
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingCreateRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
  CombatV6TrainingSessionParamsSchema,
} from '@daoyou/contracts/combat';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import { AppConfigService } from '@server/config/app-config.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AutoErrors } from './auto-errors.js';
import { CombatErrors } from './combat-errors.js';
import { TrainingService } from './training.service.js';

@Injectable()
export class TraceParamsPipe extends ZodPipe<
  z.infer<typeof CombatV6TrainingSessionParamsSchema>
> {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {
    super(CombatV6TrainingSessionParamsSchema);
  }
  override transform(value: unknown) {
    if (this.config.get('NODE_ENV') === 'production')
      throw new HttpException(
        {
          success: false,
          code: 'TRAINING_SESSION_NOT_FOUND',
          error: '训练会话不存在',
        },
        404,
      );
    return super.transform(value);
  }
}

@Controller('api/combat-v6/training')
@Access('active')
@UseFilters(CombatErrors)
export class TrainingController {
  constructor(
    @Inject(TrainingService) private readonly training: TrainingService,
  ) {}

  @Get('content')
  content() {
    return this.training.content();
  }

  @Get('sessions/current')
  current(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.training.current(actor, query.afterEventSeq);
  }

  @Post('sessions')
  @HttpCode(200)
  create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(CombatV6TrainingCreateRequestSchema))
    input: z.infer<typeof CombatV6TrainingCreateRequestSchema>,
  ) {
    return this.training.create(actor, input);
  }

  @Get('sessions/:sessionId')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingSessionParamsSchema))
    params: z.infer<typeof CombatV6TrainingSessionParamsSchema>,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.training.read(actor, params.sessionId, query.afterEventSeq);
  }

  @Put('sessions/:sessionId/commands/:unitId')
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingCommandParamsSchema))
    params: z.infer<typeof CombatV6TrainingCommandParamsSchema>,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.training.submit(actor, params.sessionId, params.unitId, input);
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
    return this.training.resolve(
      actor,
      params.sessionId,
      input.expectedRevision,
    );
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
    return this.training.resolve(
      actor,
      id,
      input.expectedRevision,
      input.round,
    );
  }

  @Delete('sessions/:sessionId')
  abandon(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6TrainingSessionParamsSchema))
    params: z.infer<typeof CombatV6TrainingSessionParamsSchema>,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.training.abandon(
      actor,
      params.sessionId,
      input.expectedRevision,
    );
  }

  @Get('sessions/:sessionId/trace')
  trace(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(TraceParamsPipe)
    params: z.infer<typeof CombatV6TrainingSessionParamsSchema>,
  ) {
    return this.training.trace(actor, params.sessionId);
  }
}
