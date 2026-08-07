import type { Game } from 'boardgame.io';
import type { BattleMatchPlayerViewV1 } from '@shared/engine/battle-v5/match/types';

export type BattleBoardgamePlayerViewV1 = BattleMatchPlayerViewV1 & {
  readonly orchestration: {
    readonly readyPlayerCount: number;
    readonly totalPlayerCount: number;
    readonly allPlayersReady: boolean;
  };
};

/** Client-only descriptor; the battle-v5 engine never imports boardgame.io. */
export const battleBoardgameClientGame: Game = {
  name: 'battle-v5-match',
  disableUndo: true,
  phases: {
    planning: {
      start: true,
      moves: {
        submitIntent: { client: false, move: () => undefined },
        lockPlayer: { client: false, move: () => undefined },
      },
    },
  },
};
