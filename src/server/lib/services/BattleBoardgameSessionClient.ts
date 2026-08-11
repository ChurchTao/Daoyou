import type { BattleBoardgamePlayerSessionV1 } from './BattleBoardgameStorage';
import { BattleMatchSessionSchema } from '@shared/contracts/battle-matches';

const DEFAULT_BATTLE_SERVER_URL = 'http://localhost:3100';

export class BattleBoardgameSessionClient {
  private readonly baseUrl = (
    process.env.BATTLE_SERVER_URL ?? DEFAULT_BATTLE_SERVER_URL
  ).replace(/\/$/, '');
  private readonly token = process.env.BATTLE_SERVER_API_TOKEN ?? '';

  async getPlayerSession(
    matchId: string,
    applicationPlayerId: string,
  ): Promise<BattleBoardgamePlayerSessionV1 | null> {
    if (!this.token) {
      throw new Error('BATTLE_SERVER_API_TOKEN is not configured');
    }
    const url = new URL(
      `/internal/battle-matches/${encodeURIComponent(matchId)}/session`,
      this.baseUrl,
    );
    url.searchParams.set('playerId', applicationPlayerId);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Battle session gateway failed: ${response.status}`);
    }
    const parsed = BattleMatchSessionSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Battle session gateway returned invalid data');
    return parsed.data as BattleBoardgamePlayerSessionV1;
  }
}
