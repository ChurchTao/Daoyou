import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { CombatAutoRequestSchema } from '@daoyou/shared/combat-v6/auto';
import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@daoyou/shared/contracts/combatV6';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { BreakthroughService } from './breakthrough.service.js';
import { taskBattleErrors } from './task-battle-errors.js';

@Controller('api/combat-v6/breakthrough/tasks/:taskId/sessions')
@Access('active')
@UseFilters(taskBattleErrors('突破战斗参数无效'))
export class BreakthroughController {
  constructor(
    @Inject(BreakthroughService)
    private readonly breakthrough: BreakthroughService,
  ) {}

  @Get('current')
  current(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('taskId', new ZodPipe(z.uuid())) taskId: string,
  ) {
    return this.breakthrough.read(actor.cultivatorId, taskId);
  }

  @Get(':id')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('taskId', new ZodPipe(z.uuid())) taskId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.breakthrough.read(
      actor.cultivatorId,
      taskId,
      id,
      query.afterEventSeq,
    );
  }

  @Put(':id/commands/:unitId')
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('taskId', new ZodPipe(z.uuid())) taskId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Param('unitId') unitId: string,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.breakthrough.change(actor, taskId, id, input.expectedRevision, {
      unitId,
      commands: input.commands,
    });
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('taskId', new ZodPipe(z.uuid())) taskId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.breakthrough.change(actor, taskId, id, input.expectedRevision);
  }

  @Post(':id/auto')
  @HttpCode(200)
  auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('taskId', new ZodPipe(z.uuid())) taskId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return this.breakthrough.change(
      actor,
      taskId,
      id,
      input.expectedRevision,
      undefined,
      input.round,
    );
  }
}
