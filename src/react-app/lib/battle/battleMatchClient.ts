import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import type { BattleMatchPlayerViewV1, ClientBattleIntentV1 } from '@shared/engine/battle-v5/match/types';
import { battleBoardgameClientGame } from '@shared/online-battle/BattleBoardgameClientGame';
import type { BattleMatchSessionV1 } from '@shared/contracts/battle-matches';

export type BattleMatchClientState = {
  readonly G?: BattleMatchPlayerViewV1;
  readonly isConnected?: boolean;
  readonly error?: string;
};

type BattleClient = ReturnType<typeof Client>;

export function createBattleMatchClient(
  session: BattleMatchSessionV1,
): BattleClient {
  return Client({
    game: battleBoardgameClientGame,
    multiplayer: SocketIO({ server: session.serverOrigin }),
    matchID: session.matchID,
    playerID: session.playerID,
    credentials: session.playerCredentials,
    debug: false,
  }) as unknown as BattleClient;
}

export function submitBattleIntent(
  client: BattleClient,
  unitId: string,
  intent: ClientBattleIntentV1,
): void {
  client.moves.submitIntent({
    requestId: crypto.randomUUID(),
    unitId,
    intent,
  });
}

export function lockBattlePlayer(client: BattleClient): void {
  client.moves.lockPlayer({ requestId: crypto.randomUUID() });
}
