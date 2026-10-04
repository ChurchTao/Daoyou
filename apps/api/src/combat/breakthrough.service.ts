import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  changeBreakthroughBattle,
  getBreakthroughBattle,
} from '@server/combat/application/CombatV6BreakthroughService.js';

@Injectable()
export class BreakthroughService {
  async read(owner: string, taskId: string, id?: string, after?: number) {
    return {
      success: true,
      data: await getBreakthroughBattle(owner, taskId, id, after),
    };
  }
  async change(
    actor: ActiveCultivatorRef,
    taskId: string,
    id: string,
    revision: number,
    command?: Parameters<typeof changeBreakthroughBattle>[4],
    round?: number,
  ) {
    return {
      success: true,
      data: await changeBreakthroughBattle(
        actor,
        taskId,
        id,
        revision,
        command,
        round,
      ),
    };
  }
}
