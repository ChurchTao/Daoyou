import type { Game } from 'boardgame.io';
import type { BattleMatchPlayerViewV1 } from '@shared/engine/battle-v5/match/types';
import type { BattlePresentationWindowV1 } from './BattlePresentation';

export type BattleBoardgamePlayerViewV1 = BattleMatchPlayerViewV1 & {
  readonly presentation?: BattlePresentationWindowV1;
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
        commitIntents: { client: false, move: () => undefined },
      },
    },
  },
};
