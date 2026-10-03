import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  advanceTower,
  changeTowerBattle,
  completeTower,
  getTowerBattle,
  getTowerView,
  startTower,
} from '@server/tower/application/runtime/combatV6.js';
import { getTowerLeaderboard } from '@server/tower/application/runtime/leaderboard.js';
import type { CombatV6TrainingCommandRequestSchema } from '@daoyou/shared/contracts/combatV6';
import { getTowerSeasonMeta } from '@daoyou/shared/lib/tower/season';
import type { z } from 'zod';

@Injectable()
export class TowerService {
  async state(owner: string) {
    return { success: true, data: await getTowerView(owner) };
  }

  async start(owner: string) {
    return { success: true, data: await startTower(owner) };
  }

  async action(
    actor: ActiveCultivatorRef,
    input: Parameters<typeof advanceTower>[1],
  ) {
    const data =
      input.action === 'complete'
        ? await completeTower(actor, input)
        : await advanceTower(actor, input);
    return { success: true, data };
  }

  async leaderboard(
    owner: string,
    realm: Parameters<typeof getTowerLeaderboard>[0]['realm'],
  ) {
    const season = getTowerSeasonMeta();
    return {
      success: true,
      data: await getTowerLeaderboard({
        seasonKey: season.seasonKey,
        seasonEndAt: season.seasonEndsAt,
        realm,
        limit: 30,
        selfCultivatorId: owner,
      }),
    };
  }

  async current(owner: string) {
    return { success: true, data: await getTowerBattle(owner) };
  }

  async read(owner: string, id: string, after: number) {
    const data = await getTowerBattle(owner, id, after);
    if (!data) throw new HttpException({ error: '战斗不存在' }, 404);
    return { success: true, data };
  }

  async submit(
    actor: ActiveCultivatorRef,
    id: string,
    unitId: string,
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return {
      success: true,
      data: await changeTowerBattle(actor, id, input.expectedRevision, {
        unitId,
        commands: input.commands,
      }),
    };
  }

  async auto(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    round: number,
  ) {
    try {
      return await this.resolve(actor, id, revision, round);
    } catch (error) {
      throw new HttpException(
        { error: error instanceof Error ? error.message : '自动指令提交失败' },
        409,
      );
    }
  }

  async resolve(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    round?: number,
  ) {
    return {
      success: true,
      data: await changeTowerBattle(actor, id, revision, undefined, round),
    };
  }
}
