import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { huntBattleReward } from '@server/hunts/application/HuntRewardProjector.js';
import {
  commandHuntTeam,
  createHuntTeam,
  huntLobby,
  joinHuntTeam,
} from '@server/hunts/application/HuntTeamService.js';
import type { HuntEventIdSchema } from '@daoyou/game-domain/hunts';
import type { HuntCreateTeamSchema, HuntTeamCommand } from '@daoyou/contracts/hunts';
import { huntEventsAt } from '@daoyou/game-rules/hunts';
import type { z } from 'zod';

@Injectable()
export class HuntsService {
  events() {
    return {
      success: true,
      data: { events: huntEventsAt(Date.now()), serverNow: Date.now() },
    };
  }

  async reward(actor: ActiveCultivatorRef, battleId: string) {
    return { success: true, data: await huntBattleReward(battleId, actor) };
  }

  async lobby(
    actor: ActiveCultivatorRef,
    eventId: z.infer<typeof HuntEventIdSchema>,
  ) {
    return { success: true, data: await huntLobby(eventId, actor) };
  }

  async create(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof HuntCreateTeamSchema>,
  ) {
    return { success: true, data: await createHuntTeam(actor, input) };
  }

  async join(
    actor: ActiveCultivatorRef,
    eventId: z.infer<typeof HuntEventIdSchema>,
    teamId?: string,
  ) {
    return { success: true, data: await joinHuntTeam(actor, eventId, teamId) };
  }

  async command(
    actor: ActiveCultivatorRef,
    teamId: string,
    input: HuntTeamCommand,
  ) {
    return { success: true, data: await commandHuntTeam(actor, teamId, input) };
  }
}
