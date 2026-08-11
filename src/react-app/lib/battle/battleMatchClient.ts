import type { BattleMatchSessionV1 } from '@shared/contracts/battle-matches';
import type {
  BattleMatchPlayerViewV1,
  ClientBattleIntentV1,
} from '@shared/engine/battle-v5/match/types';
import { battleBoardgameClientGame } from '@shared/online-battle/BattleBoardgameClientGame';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';

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

export function commitBattleIntents(
  client: BattleClient,
  intents: Readonly<Record<string, ClientBattleIntentV1>>,
  round: number,
  checkpointRevision: number,
  requestId: string = crypto.randomUUID(),
): string {
  client.moves.commitIntents({
    requestId,
    round,
    checkpointRevision,
    intents,
  });
  return requestId;
}
