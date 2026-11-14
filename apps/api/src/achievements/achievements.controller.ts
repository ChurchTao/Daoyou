import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { AchievementsService } from './achievements.service.js';

@Controller('api/achievements')
@Access('active')
export class AchievementsController {
  constructor(
    @Inject(AchievementsService)
    private readonly achievements: AchievementsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.achievements.list(actor);
  }
}
