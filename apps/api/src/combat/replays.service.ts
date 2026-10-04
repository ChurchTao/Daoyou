import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  createCombatV6ReplayShare,
  findOwnedCombatV6Replay,
  findSharedCombatV6Replay,
  listOwnedCombatV6Replays,
} from '@server/lib/repositories/combatV6ReplayRepository.js';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import { combatV6ReplayView } from '@daoyou/game-rules/combat/replay';
import { COMBAT_V6_REPLAY_ERROR_CODE } from '@daoyou/contracts/combat';
import type { CombatV6HistoryQuerySchema } from '@daoyou/contracts/combat/replays';
import type { z } from 'zod';

@Injectable()
export class ReplaysService {
  private readonly arena = new CombatV6ArenaStore();

  async read(actor: ActiveCultivatorRef, battleId: string) {
    const archive = await findOwnedCombatV6Replay(battleId, actor.cultivatorId);
    if (
      archive?.replay &&
      archive.replay.participants.some(
        (p) =>
          p.cultivatorId === actor.cultivatorId && p.userId === actor.userId,
      )
    ) {
      return {
        status: 200,
        body: {
          success: true,
          data: combatV6ReplayView(
            archive.replay,
            actor.cultivatorId,
            actor.userId,
          ),
        },
      };
    }
    const arena = await this.arena.get(battleId);
    if (
      arena?.stage === 'finished' &&
      arena.participants.some(
        (p) =>
          p.userId === actor.userId && p.cultivatorId === actor.cultivatorId,
      )
    ) {
      return {
        status: 202,
        body: {
          success: false,
          code: COMBAT_V6_REPLAY_ERROR_CODE.Pending,
          error: '战斗回放正在归档，请稍后重试',
        },
      };
    }
    return {
      status: 404,
      body: {
        success: false,
        code: COMBAT_V6_REPLAY_ERROR_CODE.NotFound,
        error: '战斗回放不存在',
      },
    };
  }

  async list(owner: string, query: z.infer<typeof CombatV6HistoryQuerySchema>) {
    return {
      success: true,
      data: await listOwnedCombatV6Replays(owner, query),
    };
  }

  async share(actor: ActiveCultivatorRef, battleId: string) {
    const shareCode = await createCombatV6ReplayShare(
      battleId,
      actor.cultivatorId,
      actor.userId,
    );
    if (!shareCode)
      throw new HttpException({ success: false, error: '战斗回放不存在' }, 404);
    return { success: true, data: { shareCode } };
  }

  async shared(shareCode: string) {
    const archive = await findSharedCombatV6Replay(shareCode);
    const viewer = archive?.replay?.participants.find(
      (p) => p.cultivatorId === archive.shareViewerCultivatorId,
    );
    if (!archive?.replay || !viewer)
      throw new HttpException({ success: false, error: '战斗回放不存在' }, 404);
    return {
      success: true,
      data: combatV6ReplayView(
        archive.replay,
        viewer.cultivatorId,
        viewer.userId,
      ),
    };
  }
}
