import {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingRevisionRequestSchema,
} from '@daoyou/contracts/combat';
import { CombatAutoRequestSchema } from '@daoyou/contracts/combat/auto';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import { Access, CurrentCultivator } from '@server/auth/access.js';
import { apiErrorFilter } from '@server/http/error-filter.js';
import { FirstQuery } from '@server/http/first-query.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z, ZodError } from 'zod';
import { BaixiaoDuelService } from './application/BaixiaoDuelService.js';
import { BaixiaoMeetService } from './application/BaixiaoMeetService.js';

const duelPath = z.object({ id: z.uuid(), sessionId: z.uuid().optional() });
type DuelPath = z.infer<typeof duelPath>;
const duelPathPipe = new ZodPipe(duelPath);

function duelId({ id, sessionId }: DuelPath) {
  if (sessionId && sessionId !== id)
    throw new NotFoundException('这场挑战不存在。');
  return id;
}

@Controller('api/baixiao-meet/duel/:id/sessions')
@Access('active')
@UseFilters(
  apiErrorFilter((error) =>
    error instanceof ZodError
      ? Response.json(
          { success: false, error: '挑战参数无效。' },
          { status: 400 },
        )
      : undefined,
  ),
)
export class BaixiaoDuelController {
  constructor(
    @Inject(BaixiaoDuelService) private readonly duels: BaixiaoDuelService,
    @Inject(BaixiaoMeetService) private readonly meet: BaixiaoMeetService,
  ) {}

  @Get(['current', ':sessionId'])
  @Header('Cache-Control', 'no-store')
  async read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(duelPathPipe) path: DuelPath,
    @FirstQuery(new ZodPipe(CombatV6TrainingEventsQuerySchema))
    query: z.infer<typeof CombatV6TrainingEventsQuerySchema>,
  ) {
    return {
      success: true,
      data: await this.duels.read(actor, duelId(path), query.afterEventSeq),
    };
  }

  @Post('recover')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async recover(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(duelPathPipe) path: DuelPath,
  ) {
    return {
      success: true,
      data: await this.meet.recoverChallenge(actor, duelId(path)),
    };
  }

  @Put(':sessionId/commands/:unitId')
  async submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(duelPathPipe) path: DuelPath,
    @Param('unitId') unitId: string,
    @JsonBody(new ZodPipe(CombatV6TrainingCommandRequestSchema))
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return this.change(actor, duelId(path), input.expectedRevision, {
      kind: 'command',
      unitId,
      commands: input.commands,
    });
  }

  @Post(':sessionId/resolve')
  @HttpCode(200)
  async resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(duelPathPipe) path: DuelPath,
    @JsonBody(new ZodPipe(CombatV6TrainingRevisionRequestSchema))
    input: z.infer<typeof CombatV6TrainingRevisionRequestSchema>,
  ) {
    return this.change(actor, duelId(path), input.expectedRevision, {
      kind: 'resolve',
    });
  }

  @Post(':sessionId/auto')
  @HttpCode(200)
  async auto(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(duelPathPipe) path: DuelPath,
    @JsonBody(new ZodPipe(CombatAutoRequestSchema))
    input: z.infer<typeof CombatAutoRequestSchema>,
  ) {
    return this.change(actor, duelId(path), input.expectedRevision, {
      kind: 'auto',
      round: input.round,
    });
  }

  private async change(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    action: Parameters<BaixiaoDuelService['change']>[3],
  ) {
    const { battle, seat } = await this.duels.change(
      actor,
      id,
      revision,
      action,
    );
    if (seat) {
      await this.meet.resolve(
        {
          week: seat.week,
          position: seat.position,
          action: 'challenge-result',
          challengeId: id,
        },
        actor,
      );
    }
    return { success: true, data: battle };
  }
}
