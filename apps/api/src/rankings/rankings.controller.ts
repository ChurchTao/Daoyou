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
import {
  RankingChallengeSchema,
  type RankingChallengeRequest,
} from '@daoyou/shared/contracts/combatV6Ranking';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import {
  ItemRankingErrors,
  RankingChallengeErrors,
  RankingListErrors,
  RankingProbeErrors,
  WealthRankingErrors,
} from './rankings-errors.js';
import { RankingsService } from './rankings.service.js';

// Hono's named query reads return the first value for repeated parameters.
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

@Controller('api/rankings')
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

  @Get('items')
  @Access('public')
  @UseFilters(ItemRankingErrors)
  items(@FirstQuery('type') type: string | string[] | undefined) {
    return this.rankings.items(first(type));
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

  @Post('probe')
  @HttpCode(200)
  @UseFilters(RankingProbeErrors)
  probe(@JsonBody() input: { targetId?: unknown }) {
    return this.rankings.probe(input);
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
