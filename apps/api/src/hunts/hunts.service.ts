import type {
  HuntCreateTeamSchema,
  HuntTeamCommand,
} from '@daoyou/contracts/hunts';
import type { HuntEventIdSchema } from '@daoyou/game-domain/hunts';
import { huntEventsAt } from '@daoyou/game-rules/hunts';
import { Injectable } from '@nestjs/common';
import { huntBattleReward } from '@server/hunts/application/HuntRewardProjector.js';
import {
  listHuntTeamChat,
  sendHuntTeamChat,
} from '@server/hunts/application/HuntTeamChat.js';
import {
  commandHuntTeam,
  createHuntTeam,
  huntLobby,
  joinHuntTeam,
  joinHuntTeamById,
  readMyHuntTeam,
} from '@server/hunts/application/HuntTeamService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
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

  async mine(actor: ActiveCultivatorRef) {
    return { success: true, data: { team: await readMyHuntTeam(actor) } };
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

  async joinTeam(actor: ActiveCultivatorRef, teamId: string) {
    return { success: true, data: await joinHuntTeamById(actor, teamId) };
  }

  async command(
    actor: ActiveCultivatorRef,
    teamId: string,
    input: HuntTeamCommand,
  ) {
    return { success: true, data: await commandHuntTeam(actor, teamId, input) };
  }

  async chat(actor: ActiveCultivatorRef, teamId: string) {
    return {
      success: true,
      data: { messages: await listHuntTeamChat(actor, teamId) },
    };
  }

  async speak(actor: ActiveCultivatorRef, teamId: string, text: string) {
    return {
      success: true,
      data: await sendHuntTeamChat(actor, teamId, text),
    };
  }
}
