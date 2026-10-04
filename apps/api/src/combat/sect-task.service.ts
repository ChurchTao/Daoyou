import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  changeSectTaskBattle,
  getSectTaskBattle,
} from '@server/combat/application/CombatV6SectTaskService.js';

@Injectable()
export class SectTaskBattleService {
  async read(owner: string, id?: string, after?: number) {
    return { success: true, data: await getSectTaskBattle(owner, id, after) };
  }
  async change(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    command?: Parameters<typeof changeSectTaskBattle>[3],
    round?: number,
  ) {
    return {
      success: true,
      data: await changeSectTaskBattle(actor, id, revision, command, round),
    };
  }
}
