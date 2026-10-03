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
import { DungeonBeginBattleRequestSchema } from '@daoyou/shared/contracts/combatV6Dungeon';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { AutoErrors } from '../combat/auto-errors.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import {
  DungeonBeginErrors,
  DungeonCompleteErrors,
  DungeonResolveErrors,
  DungeonSubmitErrors,
} from './dungeon-errors.js';
import { DungeonService } from './dungeon.service.js';

const BattleIdSchema = z.object({
  battleId: z.string().min(1),
  requestId: z.string().min(1).max(120).optional(),
});

@Controller('api/dungeon/battle')
@Access('active')
export class DungeonBattleController {
  constructor(
    @Inject(DungeonService) private readonly dungeon: DungeonService,
  ) {}

  @Post('sessions/:id/auto')
  @HttpCode(200)
  @UseFilters(AutoErrors)
  auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid(), 'legacy-unhandled')) id: string,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema, 'legacy-unhandled'))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return this.dungeon.resolve(actor, id, input.expectedRevision, input.round);
  }

  @Get('sessions/current')
  current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.dungeon.current(actor.cultivatorId);
  }

  @Get('sessions/:id')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return this.dungeon.read(actor.cultivatorId, id, query.afterEventSeq);
  }

  @Put('sessions/:id/commands/:unitId')
  @UseFilters(DungeonSubmitErrors)
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Param('unitId') unitId: string,
    @JsonBody(
      new ZodPipe(CombatV6TrainingCommandRequestSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.dungeon.submit(actor, id, unitId, input);
  }

  @Post('sessions/:id/resolve')
  @HttpCode(200)
  @UseFilters(DungeonResolveErrors)
  resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @JsonBody(
      new ZodPipe(CombatV6TrainingRevisionRequestSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.dungeon.resolve(actor, id, input.expectedRevision);
  }


  @Post('begin')
  @HttpCode(200)
  @UseFilters(DungeonBeginErrors)
  begin(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonBeginBattleRequestSchema))
    input: z.infer<typeof DungeonBeginBattleRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'battle-begin', ...input });
  }


  @Post('complete')
  @HttpCode(200)
  @UseFilters(DungeonCompleteErrors)
  complete(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(BattleIdSchema))
    input: z.infer<typeof BattleIdSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'battle-execute', ...input });
  }

}
