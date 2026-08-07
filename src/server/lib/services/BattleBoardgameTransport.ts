import type { State } from 'boardgame.io';
import { SocketIO } from './boardgameio-server';

/** Exposes only the server-side broadcast primitive needed by the timeout worker. */
export class BattleBoardgameTransport extends SocketIO {
  publishMatchState(matchID: string, state: State): void {
    this.pubSub.publish(`MATCH-${matchID}`, {
      type: 'update',
      args: [matchID, state],
    });
  }
}
