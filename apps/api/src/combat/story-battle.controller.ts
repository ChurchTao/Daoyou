import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import { CombatAutoRequestSchema } from '@daoyou/contracts/combat/auto';
import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@daoyou/contracts/combat';
import {
  changeStoryBattle,
  getStoryBattleSession,
  startStoryBattle,
} from '@server/combat/application/CombatV6StoryBattleService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { taskBattleErrors } from './task-battle-errors.js';

/** 剧情战的战局接口，形状和破境试炼一致，前端用同一套战斗界面。 */
@Controller('api/combat-v6/story-battle/sessions')
@Access('active')
@UseFilters(taskBattleErrors('剧情战参数无效'))
export class StoryBattleController {
  @Get('current')
  async current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return {
      success: true,
      data: await getStoryBattleSession(actor.cultivatorId),
    };
  }

  @Post()
  @HttpCode(200)
  async start(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return { success: true, data: await startStoryBattle(actor) };
  }

  @Get(':id')
  async read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return {
      success: true,
      data: await getStoryBattleSession(
        actor.cultivatorId,
        id,
        query.afterEventSeq,
      ),
    };
  }

  @Put(':id/commands/:unitId')
  async submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Param('unitId') unitId: string,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return {
      success: true,
      data: await changeStoryBattle(actor, id, input.expectedRevision, {
        unitId,
        commands: input.commands,
      }),
    };
  }

  @Post(':id/resolve')
  @HttpCode(200)
  async resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return {
      success: true,
      data: await changeStoryBattle(actor, id, input.expectedRevision),
    };
  }

  @Post(':id/auto')
  @HttpCode(200)
  async auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return {
      success: true,
      data: await changeStoryBattle(
        actor,
        id,
        input.expectedRevision,
        undefined,
        input.round,
      ),
    };
  }
}
