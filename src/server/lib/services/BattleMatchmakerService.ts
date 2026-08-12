import type { BattleMatchStateV1 } from '@shared/engine/battle-v5/match/types';
import { getOnlineBattleCoordinator } from './onlineBattleRuntime';
import type { OnlineBattleOrchestrationV1 } from './OnlineBattleRuntimeState';

export interface CreateBattleOnlineMatchInput {
  readonly state: BattleMatchStateV1;
  readonly acceptedPlayerIds?: readonly string[];
  readonly orchestration?: OnlineBattleOrchestrationV1;
}

export interface CreatedBattleOnlineMatchV1 {
  readonly matchID: string;
}

/** Trusted in-process match creation boundary for the Bun application. */
export class BattleMatchmakerService {
  private readonly coordinator = getOnlineBattleCoordinator();

  async createAndPrejoin(
    input: CreateBattleOnlineMatchInput,
  ): Promise<CreatedBattleOnlineMatchV1> {
    if (input.orchestration) {
      const existing = await this.findArenaMatch(input.orchestration);
      if (existing) return { matchID: existing };
    }
    const controllerPlayerIds = new Set(
      input.state.controllers.map((controller) => controller.playerId),
    );
    const acceptedPlayerIds = input.acceptedPlayerIds ?? [...controllerPlayerIds];
    if (acceptedPlayerIds.some((playerId) => !controllerPlayerIds.has(playerId))) {
      throw new Error('Accepted player is not a battle controller');
    }
    await this.coordinator.createMatch({
      match: input.state,
      acceptedPlayerIds,
      orchestration: input.orchestration,
    });
    return { matchID: input.state.matchId };
  }

  findArenaMatch(input: OnlineBattleOrchestrationV1): Promise<string | null> {
    return this.coordinator.store.findArenaMatch(input.roomId, input.startRequestId);
  }

  acceptPlayer(matchId: string, playerId: string): Promise<boolean> {
    return this.coordinator.acceptPlayer(matchId, playerId);
  }
}
