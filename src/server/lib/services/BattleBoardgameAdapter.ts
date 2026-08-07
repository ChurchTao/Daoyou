import type { Game, PlayerID } from 'boardgame.io';
import { INVALID_MOVE } from './boardgameio-core';
import {
  applyBattleRoundResolution,
  createBattleMatchPlayerView,
  transitionBattleMatch,
} from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import { resolveBattleRound } from '@shared/engine/battle-v5/round/BattleRoundResolver';
import type {
  BattleMatchStateV1,
  BattleRoundResolutionPublicV1,
  ClientBattleIntentV1,
} from '@shared/engine/battle-v5/match/types';
import type { BattleReplayRoundV1 } from '@shared/contracts/battleReplay';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';

export interface BattleBoardgameSetupDataV1 {
  readonly state: BattleMatchStateV1;
  /** boardgame.io playerID → authenticated application playerId */
  readonly playerIdByBoardgameId: Readonly<Record<string, string>>;
  /** Slots whose invite has been accepted. Missing means legacy all-ready. */
  readonly acceptedBoardgamePlayerIds?: readonly string[];
}

export interface BattleBoardgameMovePayloadV1 {
  readonly requestId: string;
  readonly unitId: string;
  readonly intent: ClientBattleIntentV1;
}

export interface BattleBoardgameLockPayloadV1 {
  readonly requestId: string;
}

export type BattleBoardgameG = BattleMatchStateV1 & {
  readonly playerIdByBoardgameId: Readonly<Record<string, string>>;
  readonly acceptedBoardgamePlayerIds: readonly string[];
  readonly replay: {
    readonly version: 'battle_replay_accumulator_v1';
    readonly initialBattle: BattleSaveV1;
    readonly rounds: readonly BattleReplayRoundV1[];
  };
};

function appPlayerId(G: BattleBoardgameG, playerID: PlayerID | null): string | null {
  return playerID && G.playerIdByBoardgameId
    ? G.playerIdByBoardgameId[playerID] ?? null
    : null;
}

function acceptedPlayerIds(G: BattleBoardgameG): readonly string[] {
  return G.acceptedBoardgamePlayerIds ?? Object.keys(G.playerIdByBoardgameId);
}

function serverNow(): number {
  const now = Date.now();
  if (!Number.isFinite(now)) throw new Error('Battle server clock is invalid');
  return now;
}

/**
 * Optional boardgame.io adapter. The battle engine remains the authority:
 * boardgame moves only translate authenticated player actions into the pure
 * BattleMatch state transition. Deadline workers must still call the match
 * coordinator's resolveExpired method; a client move must never be treated as
 * a trusted timeout signal.
 */
export function createBattleBoardgameGame(): Game<
  BattleBoardgameG,
  Record<string, unknown>,
  BattleBoardgameSetupDataV1
> {
  return {
    name: 'battle-v5-match',
    minPlayers: 2,
    maxPlayers: 8,
    disableUndo: true,
    setup: (_context, setupData) => {
      if (!setupData) throw new Error('Battle boardgame setup data is required');
      return {
        ...setupData.state,
        playerIdByBoardgameId: setupData.playerIdByBoardgameId,
        acceptedBoardgamePlayerIds:
          setupData.acceptedBoardgamePlayerIds ?? Object.keys(setupData.playerIdByBoardgameId),
        replay: {
          version: 'battle_replay_accumulator_v1',
          initialBattle: structuredClone(setupData.state.battle),
          rounds: [],
        },
      };
    },
    validateSetupData: (setupData, numPlayers) => {
      if (!setupData) return 'Battle setup data is required';
      if (setupData.state.version !== 'battle_match_state_v1') {
        return 'Battle setup state has an invalid version';
      }
      if (Object.keys(setupData.playerIdByBoardgameId).length !== numPlayers) {
        return 'Battle player mapping does not match the lobby player count';
      }
      const controllerIds = new Set(
        setupData.state.controllers.map((controller) => controller.playerId),
      );
      const mappedIds = Object.values(setupData.playerIdByBoardgameId);
      if (
        mappedIds.length !== controllerIds.size ||
        mappedIds.some((playerId) => !controllerIds.has(playerId))
      ) {
        return 'Battle player mapping does not match controllers';
      }
      return undefined;
    },
    turn: {
      activePlayers: { all: 'planning' },
    },
    phases: {
      planning: {
        start: true,
        moves: {
          submitIntent: {
            client: false,
            // Simultaneous planners legitimately submit against the same
            // client state. The server still applies each move to its latest
            // authoritative G and the domain transition enforces revisions,
            // ownership, locking, and request idempotency.
            ignoreStaleStateID: true,
          move: ({ G, playerID }, payload: BattleBoardgameMovePayloadV1) => {
            const appId = appPlayerId(G, playerID);
            if (!appId || !playerID || !acceptedPlayerIds(G).includes(playerID) || !isIntentPayload(payload)) return INVALID_MOVE;
              try {
                return transitionAndResolve(
                  G,
                  {
                    type: 'submit_unit_intent',
                    matchId: G.matchId,
                    requestId: payload.requestId,
                    playerId: appId,
                    expectedMatchRevision: G.revision,
                    expectedCheckpointRevision: G.battle.checkpoint.checkpointRevision,
                    unitId: payload.unitId,
                    intent: payload.intent,
                  },
                  serverNow(),
                );
              } catch {
                return INVALID_MOVE;
              }
            },
          },
          lockPlayer: {
            client: false,
            ignoreStaleStateID: true,
          move: ({ G, playerID }, payload: BattleBoardgameLockPayloadV1) => {
            const appId = appPlayerId(G, playerID);
            if (!appId || !playerID || !acceptedPlayerIds(G).includes(playerID) || !payload || typeof payload.requestId !== 'string') {
                return INVALID_MOVE;
              }
              try {
                return transitionAndResolve(
                  G,
                  {
                    type: 'lock_player',
                    matchId: G.matchId,
                    requestId: payload.requestId,
                    playerId: appId,
                    expectedMatchRevision: G.revision,
                    expectedCheckpointRevision: G.battle.checkpoint.checkpointRevision,
                  },
                  serverNow(),
                );
              } catch {
                return INVALID_MOVE;
              }
            },
          },
        },
      },
    },
    endIf: ({ G }) =>
      G.status === 'finished' ? { result: G.latestResolution?.outcome } : undefined,
    playerView: ({ G, playerID }) => {
      const appId = appPlayerId(G, playerID);
      if (!appId) {
        return {
          matchId: G.matchId,
          status: G.status,
          revision: G.revision,
          round: G.planning?.round ?? G.battle.checkpoint.round,
        };
      }
      const ready = acceptedPlayerIds(G);
      return {
        ...createBattleMatchPlayerView(G, appId, Date.now()),
        orchestration: {
          readyPlayerCount: ready.length,
          totalPlayerCount: G.controllers.length,
          allPlayersReady: ready.length === G.controllers.length,
        },
      };
    },
  };
}

/** Trusted worker hook; never expose this as a client move. */
export function resolveBoardgameTimeout(
  G: BattleBoardgameG,
  now: number,
): BattleBoardgameG {
  if (!Number.isFinite(now)) throw new Error('Boardgame timeout time must be finite');
  if (acceptedPlayerIds(G).length < G.controllers.length) return G;
  return transitionAndResolve(
    G,
    {
      type: 'resolve_planning_timeout',
      matchId: G.matchId,
      requestId: `timeout:${G.matchId}:${G.planning?.round ?? 0}:${G.battle.checkpoint.checkpointRevision}`,
      expectedMatchRevision: G.revision,
      expectedCheckpointRevision: G.battle.checkpoint.checkpointRevision,
    },
    now,
  );
}

/** Trusted recovery hook for a match persisted in `resolving` before a crash. */
export function resumeBoardgameResolution(
  G: BattleBoardgameG,
  now: number,
): BattleBoardgameG {
  if (G.status !== 'resolving' || !G.resolving) return G;
  const resolution = resolveBattleRound(G.battle, G.resolving.commandSet);
  const resolved = applyBattleRoundResolution(G, resolution, now);
  return {
    ...resolved,
    revision: G.revision + 1,
    playerIdByBoardgameId: G.playerIdByBoardgameId,
    acceptedBoardgamePlayerIds: acceptedPlayerIds(G),
    replay: appendReplayRound(G, G.resolving.commandSet, resolution),
  };
}

function transitionAndResolve(
  G: BattleBoardgameG,
  command: Parameters<typeof transitionBattleMatch>[1],
  now: number,
): BattleBoardgameG {
  const transition = transitionBattleMatch(G, command, now);
  const effect = transition.effects[0];
  if (!effect) {
    return {
      ...transition.state,
      playerIdByBoardgameId: G.playerIdByBoardgameId,
      acceptedBoardgamePlayerIds: acceptedPlayerIds(G),
      replay: G.replay,
    };
  }
  const resolution = resolveBattleRound(
    transition.state.battle,
    effect.commandSet,
  );
  const resolved = applyBattleRoundResolution(
    transition.state,
    resolution,
    now,
  );
  // A boardgame move is one externally visible revision even though the
  // internal transition first seals and then applies the round resolution.
  return {
    ...resolved,
    revision: G.revision + 1,
    playerIdByBoardgameId: G.playerIdByBoardgameId,
    acceptedBoardgamePlayerIds: acceptedPlayerIds(G),
    replay: appendReplayRound(G, effect.commandSet, resolution),
  };
}

function appendReplayRound(
  G: BattleBoardgameG,
  commandSet: import('@shared/engine/battle-v5/round/types').RoundCommandSetV1,
  resolution: import('@shared/engine/battle-v5/round/types').BattleRoundResolutionV1,
): BattleBoardgameG['replay'] {
  if (G.replay.rounds.some((round) => round.commandSet.commandSetId === commandSet.commandSetId)) {
    return G.replay;
  }
  return {
    ...G.replay,
    rounds: [
      ...G.replay.rounds,
      {
        round: resolution.round,
        commandSet,
        resolution: toPublicResolution(resolution),
      },
    ],
  };
}

function toPublicResolution(
  resolution: import('@shared/engine/battle-v5/round/types').BattleRoundResolutionV1,
): BattleRoundResolutionPublicV1 {
  return {
    version: 'battle_round_resolution_public_v1',
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
    stateTimeline: resolution.stateTimeline,
  };
}

function isIntentPayload(value: unknown): value is BattleBoardgameMovePayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<BattleBoardgameMovePayloadV1>;
  return (
    typeof payload.requestId === 'string' &&
    payload.requestId.length > 0 &&
    typeof payload.unitId === 'string' &&
    Boolean(payload.intent) &&
    typeof payload.intent === 'object' &&
    (payload.intent.kind === 'pass' || payload.intent.kind === 'ability')
  );
}
