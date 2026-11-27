import {
  RankingChallengeSchema,
  type RankingChallengeRequest,
} from '@daoyou/contracts/combat/ranking';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { StoryGate } from '../story/story-gate.guard.js';
import {
  RankingChallengeErrors,
  RankingListErrors,
  WealthRankingErrors,
} from './rankings-errors.js';
import { RankingsService } from './rankings.service.js';

// Hono's named query reads return the first value for repeated parameters.
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

@Controller('api/rankings')
@StoryGate('rankings')
@Access('active')
export class RankingsController {
  constructor(
    @Inject(RankingsService) private readonly rankings: RankingsService,
  ) {}

  @Get()
  @Access('public')
  @UseFilters(RankingListErrors)
  list(@FirstQuery('realm') realm: string | string[] | undefined) {
    return this.rankings.list(first(realm));
  }

  @Get('wealth')
  @Access('public')
  @UseFilters(WealthRankingErrors)
  wealth() {
    return this.rankings.wealth();
  }

  @Get('my-rank')
  myRank(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('realm') realm: string | string[] | undefined,
  ) {
    return this.rankings.myRank(actor, first(realm));
  }

  @Get('challenge/current')
  @Header('Cache-Control', 'no-store')
  current(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.rankings.current(actor);
  }

  @Post('challenge-battle/v6')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseFilters(RankingChallengeErrors)
  challenge(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(RankingChallengeSchema))
    input: RankingChallengeRequest,
  ) {
    return this.rankings.challenge(actor, input);
  }
}
