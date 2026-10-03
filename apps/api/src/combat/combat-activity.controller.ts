import { Controller, Get, Inject } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { CombatActivityService } from './combat-activity.service.js';

@Controller('api/combat-v6/activity')
@Access('active')
export class CombatActivityController {
  constructor(
    @Inject(CombatActivityService)
    private readonly activity: CombatActivityService,
  ) {}

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.activity.read(actor.cultivatorId);
  }
}
