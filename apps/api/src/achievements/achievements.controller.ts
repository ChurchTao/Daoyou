import {
  ClaimAchievementRewardsSchema,
  type ClaimAchievementRewardsRequest,
} from '@daoyou/contracts/achievements';
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
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AchievementsService } from './achievements.service.js';

@Controller('api/achievements')
@Access('active')
@UseFilters(
  apiErrorFilter((error) =>
    error instanceof z.ZodError
      ? Response.json(
          { error: error.issues[0]?.message ?? '领奖参数无效' },
          { status: 400 },
        )
      : undefined,
  ),
)
export class AchievementsController {
  constructor(
    @Inject(AchievementsService)
    private readonly achievements: AchievementsService,
  ) {}

  @Post('claim')
  @HttpCode(200)
  claim(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(ClaimAchievementRewardsSchema),
    )
    input: ClaimAchievementRewardsRequest,
  ) {
    return this.achievements.claim(actor, input);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.achievements.list(actor);
  }
}
