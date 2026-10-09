import {
  HuntCreateTeamSchema,
  HuntTeamCommandSchema,
  type HuntTeamCommand,
} from '@daoyou/contracts/hunts';
import { HuntEventIdSchema } from '@daoyou/game-domain/hunts';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ArenaV6Error } from '@server/combat/application/CombatV6ArenaService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { isRedisLockContention } from '@server/lib/redis/lock.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { HuntsService } from './hunts.service.js';

const HuntsErrors = apiErrorFilter((error) => {
  let status = 500;
  let message = '暂时联系不上讨伐队伍，请稍后再试';
  if (error instanceof ArenaV6Error) {
    status = error.status;
    message = error.message;
  } else if (error instanceof z.ZodError) {
    status = 400;
    message = '未能完成操作，请刷新后再试';
  } else if (isRedisLockContention(error)) {
    status = 409;
    message = '队伍正忙，请稍后再试';
  } else {
    console.error('[hunt] request failed', error);
  }
  return Response.json(
    { success: false, error: message },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
});
const JoinSchema = z.object({ teamId: z.uuid().optional() }).strict();

@Controller('api/hunts')
@Access('active')
@UseFilters(HuntsErrors)
export class HuntsController {
  constructor(@Inject(HuntsService) private readonly hunts: HuntsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  events() {
    return this.hunts.events();
  }

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  mine(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.hunts.mine(actor);
  }

  @Get('battles/:battleId/reward')
  @Header('Cache-Control', 'private, no-store')
  reward(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('battleId', new ZodPipe(z.uuid())) battleId: string,
  ) {
    return this.hunts.reward(actor, battleId);
  }

  @Get(':eventId')
  @Header('Cache-Control', 'private, no-store')
  lobby(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('eventId', new ZodPipe(HuntEventIdSchema))
    eventId: z.infer<typeof HuntEventIdSchema>,
  ) {
    return this.hunts.lobby(actor, eventId);
  }

  @Post('teams')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(HuntCreateTeamSchema))
    input: z.infer<typeof HuntCreateTeamSchema>,
  ) {
    return this.hunts.create(actor, input);
  }

  @Post(':eventId/join')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  join(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('eventId', new ZodPipe(HuntEventIdSchema))
    eventId: z.infer<typeof HuntEventIdSchema>,
    @JsonBody({ fallback: undefined }, new ZodPipe(JoinSchema))
    input: z.infer<typeof JoinSchema>,
  ) {
    return this.hunts.join(actor, eventId, input.teamId);
  }

  @Post('teams/:teamId/join')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  joinTeam(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('teamId', new ZodPipe(z.uuid())) teamId: string,
  ) {
    return this.hunts.joinTeam(actor, teamId);
  }

  @Post('teams/:teamId')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  command(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('teamId', new ZodPipe(z.uuid())) teamId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(HuntTeamCommandSchema))
    input: HuntTeamCommand,
  ) {
    return this.hunts.command(actor, teamId, input);
  }
}
