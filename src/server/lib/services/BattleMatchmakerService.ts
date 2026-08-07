import type { BattleMatchSessionV1 } from '@shared/contracts/battle-matches';
import type {
  BattleMatchStateV1,
} from '@shared/engine/battle-v5/match/types';

const GAME_NAME = 'battle-v5-match';

export interface CreateBattleOnlineMatchInput {
  readonly state: BattleMatchStateV1;
  readonly playerNames?: Readonly<Record<string, string>>;
  /** By default all slots are prejoined for trusted smoke/admin callers. */
  readonly prejoinControllerIndexes?: readonly number[];
  readonly acceptedControllerIndexes?: readonly number[];
}

export interface CreatedBattleOnlineMatchV1 {
  readonly matchID: string;
  readonly sessions: readonly BattleMatchSessionV1[];
}

/**
 * Trusted application-side matchmaker. It is intentionally not exposed as a
 * browser route: the caller must already have built and authorized the match
 * state, while the battle-server token stays inside the application service.
 */
export class BattleMatchmakerService {
  private readonly baseUrl = (
    process.env.BATTLE_SERVER_URL ?? 'http://localhost:3100'
  ).replace(/\/$/, '');
  private readonly token = process.env.BATTLE_SERVER_API_TOKEN ?? '';
  private readonly publicOrigin =
    process.env.BATTLE_SERVER_PUBLIC_ORIGIN ?? this.baseUrl;

  async createAndPrejoin(
    input: CreateBattleOnlineMatchInput,
  ): Promise<CreatedBattleOnlineMatchV1> {
    if (!this.token) throw new Error('BATTLE_SERVER_API_TOKEN is not configured');
    const controllers = input.state.controllers;
    const playerIdByBoardgameId = Object.fromEntries(
      controllers.map((controller, index) => [String(index), controller.playerId]),
    );
    const created = await this.request<{ matchID: string }>(
      `/games/${GAME_NAME}/create`,
      {
        method: 'POST',
        body: {
          numPlayers: controllers.length,
          unlisted: true,
          setupData: {
            state: input.state,
            playerIdByBoardgameId,
            acceptedBoardgamePlayerIds: (
              input.acceptedControllerIndexes ??
              input.prejoinControllerIndexes ??
              controllers.map((_, index) => index)
            )
              .map((index) => String(index)),
          },
        },
      },
    );
    const sessions: BattleMatchSessionV1[] = [];
    try {
      const indexes = input.prejoinControllerIndexes ?? controllers.map((_, index) => index);
      for (const index of indexes) {
        const controller = controllers[index];
        if (!controller) throw new Error(`Unknown battle controller index: ${index}`);
        const joined = await this.joinPlayer(created.matchID, String(index),
          input.playerNames?.[controller.playerId] ?? controller.playerId);
        sessions.push({
          gameName: GAME_NAME,
          matchID: created.matchID,
          playerID: joined.playerID,
          playerCredentials: joined.playerCredentials,
          serverOrigin: this.publicOrigin,
        });
      }
    } catch (error) {
      await this.rollbackJoins(created.matchID, sessions);
      throw error;
    }
    return { matchID: created.matchID, sessions };
  }

  async joinPlayer(matchID: string, playerID: string, playerName: string): Promise<BattleMatchSessionV1> {
    const joined = await this.request<{ playerID: string; playerCredentials: string }>(
      `/games/${GAME_NAME}/${encodeURIComponent(matchID)}/join`,
      {
        method: 'POST',
        body: { playerID, playerName: normalizePlayerName(playerName) },
      },
    );
    return {
      gameName: GAME_NAME,
      matchID,
      playerID: joined.playerID,
      playerCredentials: joined.playerCredentials,
      serverOrigin: this.publicOrigin,
    };
  }

  async acceptPlayer(matchID: string, playerID: string): Promise<void> {
    await this.request(`/internal/battle-matches/${encodeURIComponent(matchID)}/accept`, {
      method: 'POST', body: { playerID },
    });
  }

  private async rollbackJoins(
    matchID: string,
    sessions: readonly BattleMatchSessionV1[],
  ): Promise<void> {
    for (const session of [...sessions].reverse()) {
      try {
        await this.request(`/games/${GAME_NAME}/${encodeURIComponent(matchID)}/leave`, {
          method: 'POST',
          body: {
            playerID: session.playerID,
            credentials: session.playerCredentials,
          },
        });
      } catch (error) {
        console.warn('[battle-matchmaker] rollback join failed', { matchID, error });
      }
    }
  }

  private async request<T = unknown>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: unknown },
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(5_000),
    });
    const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? payload.error
          : undefined;
      throw new Error(message || `Battle matchmaker request failed: ${response.status}`);
    }
    return payload as T;
  }
}

function normalizePlayerName(value: string): string {
  const name = value.trim().slice(0, 80);
  if (!name) throw new Error('Battle player name is required');
  return name;
}
