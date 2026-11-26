import {
  ContestBrewSchema,
  ContestStartSchema,
  type ContestBrewCommand,
} from '@daoyou/contracts/alchemy/contest';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Access, CurrentCultivator } from '@server/auth/access.js';
import { FirstQuery } from '@server/http/first-query.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { StoryGate } from '@server/story/story-gate.guard.js';
import { AlchemyContestService } from './application/AlchemyContestService.js';

@Controller('api/alchemy-contest')
@Access('active')
export class AlchemyContestController {
  constructor(
    @Inject(AlchemyContestService)
    private readonly contest: AlchemyContestService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.contest.status(actor);
  }

  @Post('start')
  @HttpCode(200)
  @StoryGate('alchemy')
  start(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(ContestStartSchema)) command: { week: string },
  ) {
    return this.contest.start(command.week, actor);
  }

  @Post('brew')
  @HttpCode(200)
  @StoryGate('alchemy')
  brew(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(ContestBrewSchema)) command: ContestBrewCommand,
  ) {
    return this.contest.brew(command, actor);
  }

  @Post('finish')
  @HttpCode(200)
  @StoryGate('alchemy')
  finish(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(ContestStartSchema)) command: { week: string },
  ) {
    return this.contest.finish(command.week, actor);
  }

  @Get('ranking')
  @Header('Cache-Control', 'no-store')
  ranking(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('period') period: string | undefined,
  ) {
    return this.contest.ranking(actor, period === 'previous');
  }

  @Get('ranking/:cultivatorId')
  @Header('Cache-Control', 'no-store')
  rankingDetail(
    @Param('cultivatorId', ParseUUIDPipe) cultivatorId: string,
    @FirstQuery('week') week: string | undefined,
  ) {
    return this.contest.rankingDetail(cultivatorId, week);
  }
}
