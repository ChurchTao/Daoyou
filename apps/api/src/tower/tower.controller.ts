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
import { TOWER_BLESSING_IDS } from '@daoyou/game-domain/tower';
import { TOWER_ELIGIBLE_REALMS } from '@daoyou/game-rules/tower';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { TowerErrors } from './tower-errors.js';
import { TowerService } from './tower.service.js';

const ActionSchema = z.object({
  runId: z.uuid(),
  revision: z.number().int().min(0),
  action: z.enum(['battle', 'blessing', 'leave', 'complete']),
  blessingId: z.enum(TOWER_BLESSING_IDS).optional(),
});
const RealmSchema = z.enum(TOWER_ELIGIBLE_REALMS);

@Controller('api/tower')
@Access('active')
@UseFilters(TowerErrors)
export class TowerController {
  constructor(@Inject(TowerService) private readonly tower: TowerService) {}

  @Get('state')
  state(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.tower.state(actor.cultivatorId);
  }

  @Post('start')
  @HttpCode(200)
  start(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.tower.start(actor.cultivatorId);
  }

  @Post('action')
  @HttpCode(200)
  action(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(ActionSchema)) input: z.infer<typeof ActionSchema>,
  ) {
    return this.tower.action(actor, input);
  }

  @Get('leaderboard')
  leaderboard(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('realm', new ZodPipe(RealmSchema))
    realm: z.infer<typeof RealmSchema>,
  ) {
    return this.tower.leaderboard(actor.cultivatorId, realm);
  }

  @Get('battle/sessions/current')
  current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.tower.current(actor.cultivatorId);
  }

  @Get('battle/sessions/:id')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.tower.read(actor.cultivatorId, id, query.afterEventSeq);
  }

  @Put('battle/sessions/:id/commands/:unitId')
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Param('unitId') unitId: string,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.tower.submit(actor, id, unitId, input);
  }

  @Post('battle/sessions/:id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.tower.resolve(actor, id, input.expectedRevision);
  }

  @Post('battle/sessions/:id/auto')
  @HttpCode(200)
  auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return this.tower.auto(actor, id, input.expectedRevision, input.round);
  }



}
