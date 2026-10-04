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
import { CombatAutoRequestSchema } from '@daoyou/contracts/combat/auto';
import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@daoyou/contracts/combat';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SectTaskBattleService } from './sect-task.service.js';
import { taskBattleErrors } from './task-battle-errors.js';

@Controller('api/combat-v6/sect-tasks/sessions')
@Access('active')
@UseFilters(taskBattleErrors('宗门战斗参数无效'))
export class SectTaskBattleController {
  constructor(
    @Inject(SectTaskBattleService)
    private readonly battle: SectTaskBattleService,
  ) {}

  @Get('current')
  current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.battle.read(actor.cultivatorId);
  }

  @Get(':id')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.battle.read(actor.cultivatorId, id, query.afterEventSeq);
  }

  @Put(':id/commands/:unitId')
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Param('unitId') unitId: string,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.battle.change(actor, id, input.expectedRevision, {
      unitId,
      commands: input.commands,
    });
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.battle.change(actor, id, input.expectedRevision);
  }

  @Post(':id/auto')
  @HttpCode(200)
  auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return this.battle.change(
      actor,
      id,
      input.expectedRevision,
      undefined,
      input.round,
    );
  }
}
