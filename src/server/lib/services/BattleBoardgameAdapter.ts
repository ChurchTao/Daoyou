import type {
  BattleReplayRoundResolutionV1,
  BattleReplayRoundV1,
} from '@shared/contracts/battleReplay';
import {
  applyBattleRoundResolution,
  cancelBattleResolution,
  createBattleMatchPlayerView,
  markBattleResolutionFailed,
  retryFailedBattleResolution,
  transitionBattleMatch,
} from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import { createBattlePublicSnapshot } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import type {
  BattleCommandReceiptV1,
  BattleCommandRejectionReasonV1,
  BattleMatchStateV1,
  ClientBattleIntentV1,
} from '@shared/engine/battle-v5/match/types';
import { resolveBattleAbilityVisual } from '@shared/engine/battle-v5/presentation';
import { resolveBattleRound } from '@shared/engine/battle-v5/round/BattleRoundResolver';
import { ROUND_PLANNING_TIMEOUT_MS } from '@shared/engine/battle-v5/round/types';
import {
  createBattleRoundPlaybackPlan,
  type BattlePresentationWindowV1,
} from '@shared/online-battle/BattlePresentation';
import type { Game, PlayerID } from 'boardgame.io';
import { INVALID_MOVE } from './boardgameio-core';

export interface BattleBoardgameSetupDataV1 {
  readonly state: BattleMatchStateV1;
  /** boardgame.io playerID → authenticated application playerId */
  readonly playerIdByBoardgameId: Readonly<Record<string, string>>;
  /** Slots whose invite has been accepted. */
  readonly acceptedBoardgamePlayerIds: readonly string[];
  readonly orchestration?: {
    readonly kind: 'arena_sparring_v1';
    readonly roomId: string;
    readonly startRequestId: string;
  };
}

export interface BattleBoardgameMovePayloadV1 {
  readonly requestId: string;
  readonly round: number;
  readonly checkpointRevision: number;
  readonly intents: Readonly<Record<string, ClientBattleIntentV1>>;
}

export type BattleBoardgameG = BattleMatchStateV1 & {
  readonly playerIdByBoardgameId: Readonly<Record<string, string>>;
  readonly acceptedBoardgamePlayerIds: readonly string[];
  readonly presentation?: BattlePresentationWindowV1;
  readonly commandReceiptsByPlayerId: Readonly<
    Record<string, BattleCommandReceiptV1>
  >;
  readonly replay: {
    readonly version: 'battle_replay_accumulator_v1';
    readonly rounds: readonly BattleReplayRoundV1[];
  };
};

function appPlayerId(
  G: BattleBoardgameG,
  playerID: PlayerID | null,
): string | null {
  return playerID && G.playerIdByBoardgameId
    ? (G.playerIdByBoardgameId[playerID] ?? null)
    : null;
}

function acceptedPlayerIds(G: BattleBoardgameG): readonly string[] {
  return G.acceptedBoardgamePlayerIds;
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
      if (!setupData)
        throw new Error('Battle boardgame setup data is required');
      return {
        ...setupData.state,
        playerIdByBoardgameId: setupData.playerIdByBoardgameId,
        acceptedBoardgamePlayerIds: setupData.acceptedBoardgamePlayerIds,
        presentation: undefined,
        commandReceiptsByPlayerId: {},
        replay: {
          version: 'battle_replay_accumulator_v1',
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
      const playerSlots = new Set(Object.keys(setupData.playerIdByBoardgameId));
      if (
        new Set(setupData.acceptedBoardgamePlayerIds).size !==
          setupData.acceptedBoardgamePlayerIds.length ||
        setupData.acceptedBoardgamePlayerIds.some((slot) => !playerSlots.has(slot))
      ) {
        return 'Battle accepted player slots are invalid';
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
          commitIntents: {
            client: false,
            // Match revision may advance when another simultaneous planner
            // commits, so boardgame.io's transport stateID is not the domain
            // epoch. The payload still carries round + checkpoint revision,
            // preventing a delayed command from leaking into a later round.
            ignoreStaleStateID: true,
            move: ({ G, playerID }, payload: BattleBoardgameMovePayloadV1) => {
              if (isPresentationActive(G, serverNow())) return INVALID_MOVE;
              const appId = appPlayerId(G, playerID);
              if (
                !appId ||
                !playerID ||
                !acceptedPlayerIds(G).includes(playerID) ||
                !isIntentPayload(payload)
              )
                return INVALID_MOVE;
              const receivedAt = serverNow();
              try {
                if (payload.round !== G.planning?.round) {
                  throw new Error('Battle planning round is stale');
                }
                const duplicate = G.processedRequestIds.includes(
                  payload.requestId,
                );
                const next = transitionAndSeal(
                  G,
                  {
                    type: 'commit_player_intents',
                    matchId: G.matchId,
                    requestId: payload.requestId,
                    playerId: appId,
                    expectedMatchRevision: G.revision,
                    expectedCheckpointRevision: payload.checkpointRevision,
                    intents: payload.intents,
                  },
                  receivedAt,
                );
                return withCommandReceipt(next, appId, {
                  requestId: payload.requestId,
                  status: duplicate ? 'duplicate' : 'accepted',
                  matchRevision: next.revision,
                  checkpointRevision: next.battle.checkpoint.checkpointRevision,
                  receivedAt,
                });
              } catch (error) {
                logRejectedMove(
                  'commitIntents',
                  G,
                  playerID,
                  payload?.requestId,
                  error,
                );
                return withCommandReceipt(G, appId, {
                  requestId: payload.requestId,
                  status: 'rejected',
                  reason: rejectionReason(error),
                  matchRevision: G.revision,
                  checkpointRevision: G.battle.checkpoint.checkpointRevision,
                  receivedAt,
                });
              }
            },
          },
        },
      },
    },
    endIf: ({ G }) =>
      G.status === 'finished' && !G.presentation
        ? { result: G.latestResolution?.outcome }
        : G.status === 'cancelled'
          ? { cancelled: true }
          : undefined,
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
        commandReceipt: G.commandReceiptsByPlayerId[appId],
        presentation: G.presentation,
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
  if (!Number.isFinite(now))
    throw new Error('Boardgame timeout time must be finite');
  if (G.presentation) return G;
  if (acceptedPlayerIds(G).length < G.controllers.length) return G;
  return transitionAndSeal(
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

/** Trusted scheduler hook: closes the server presentation gate. */
export function completeBoardgamePresentation(
  G: BattleBoardgameG,
  now: number,
): BattleBoardgameG {
  if (!G.presentation || now < G.presentation.endsAt) return G;
  return {
    ...G,
    presentation: undefined,
    revision: G.revision + 1,
    updatedAt: now,
  };
}

/** Trusted recovery hook for a match persisted in `resolving` before a crash. */
export function resumeBoardgameResolution(
  G: BattleBoardgameG,
  now: number,
): BattleBoardgameG {
  if (G.status !== 'resolving' || !G.resolving) return G;
  const resolution = resolveBattleRound(G.battle, G.resolving.commandSet);
  const resolved = applyBattleRoundResolution(G, resolution, now);
  const presentation = createPresentationWindow(G, resolution, now);
  return {
    ...resolved,
    planning: resolved.planning
      ? {
          ...resolved.planning,
          deadlineAt: presentation.endsAt + ROUND_PLANNING_TIMEOUT_MS,
        }
      : undefined,
    presentation,
    revision: G.revision + 1,
    playerIdByBoardgameId: G.playerIdByBoardgameId,
    acceptedBoardgamePlayerIds: acceptedPlayerIds(G),
    commandReceiptsByPlayerId: G.commandReceiptsByPlayerId,
    replay: appendReplayRound(G, G.resolving.commandSet, resolution),
  };
}

export function failBoardgameResolution(
  G: BattleBoardgameG,
  error: unknown,
  now: number,
): BattleBoardgameG {
  if (G.status !== 'resolving' || !G.resolving) return G;
  const failed = markBattleResolutionFailed(G, error, now);
  return {
    ...G,
    ...failed,
  };
}

export function retryBoardgameResolution(
  G: BattleBoardgameG,
  now: number,
): BattleBoardgameG {
  if (G.status !== 'resolution_failed' || !G.resolving) return G;
  const retried = retryFailedBattleResolution(G, now);
  return {
    ...G,
    ...retried,
  };
}

export function technicalAbortBoardgameMatch(
  G: BattleBoardgameG,
  now: number,
): BattleBoardgameG {
  if (G.status !== 'resolution_failed' && G.status !== 'resolving') return G;
  const cancelled = cancelBattleResolution(G, now);
  return {
    ...G,
    ...cancelled,
    planning: undefined,
    resolving: undefined,
    presentation: undefined,
  };
}

function transitionAndSeal(
  G: BattleBoardgameG,
  command: Parameters<typeof transitionBattleMatch>[1],
  now: number,
): BattleBoardgameG {
  const transition = transitionBattleMatch(G, command, now);
  // Sealing is the durable boundary. Resolution is deliberately deferred to
  // the trusted worker so a crash cannot leave an expired planning state.
  return {
    ...transition.state,
    revision: transition.changed ? G.revision + 1 : G.revision,
    playerIdByBoardgameId: G.playerIdByBoardgameId,
    acceptedBoardgamePlayerIds: acceptedPlayerIds(G),
    commandReceiptsByPlayerId: G.commandReceiptsByPlayerId,
    replay: G.replay,
  };
}

function withCommandReceipt(
  G: BattleBoardgameG,
  playerId: string,
  receipt: BattleCommandReceiptV1,
): BattleBoardgameG {
  return {
    ...G,
    commandReceiptsByPlayerId: {
      ...G.commandReceiptsByPlayerId,
      [playerId]: receipt,
    },
  };
}

function rejectionReason(error: unknown): BattleCommandRejectionReasonV1 {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('deadline')) return 'deadline_reached';
  if (message.includes('Committed player')) return 'already_committed';
  if (message.includes('checkpoint revision')) return 'stale_checkpoint';
  if (message.includes('planning round')) return 'stale_checkpoint';
  if (message.includes('match revision')) return 'stale_match';
  if (message.includes('not planning')) return 'match_not_planning';
  return 'invalid_intents';
}

function createPresentationWindow(
  G: BattleBoardgameG,
  resolution: import('@shared/engine/battle-v5/round/types').BattleRoundResolutionV1,
  now: number,
): BattlePresentationWindowV1 {
  const publicResolution = {
    version: 'battle_round_resolution_public_v1' as const,
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
  };
  const abilityConfigs = new Map(
    G.battle.blueprint.teams.flatMap((team) =>
      team.units.flatMap((unit) =>
        unit.abilityConfigs.map((config) => [config.slug, config] as const),
      ),
    ),
  );
  const plan = createBattleRoundPlaybackPlan(publicResolution, (sequence) => {
    const abilityId =
      sequence.ability?.id ??
      sequence.facts.find((fact) => fact.origin.carrier.kind === 'ability')
        ?.origin.carrier.id;
    return abilityId
      ? resolveBattleAbilityVisual(abilityId, abilityConfigs.get(abilityId))
      : undefined;
  });
  return {
    commandSetId: resolution.commandSetId,
    startedAt: now,
    endsAt: now + plan.durationMs,
    startingPublicSnapshot: createBattlePublicSnapshot(G.battle),
    plan,
  };
}

function isPresentationActive(G: BattleBoardgameG, now: number): boolean {
  return Boolean(G.presentation && now < G.presentation.endsAt);
}

function appendReplayRound(
  G: BattleBoardgameG,
  commandSet: import('@shared/engine/battle-v5/round/types').RoundCommandSetV1,
  resolution: import('@shared/engine/battle-v5/round/types').BattleRoundResolutionV1,
): BattleBoardgameG['replay'] {
  if (
    G.replay.rounds.some(
      (round) => round.commandSet.commandSetId === commandSet.commandSetId,
    )
  ) {
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
): BattleReplayRoundResolutionV1 {
  return {
    version: 'battle_replay_round_resolution_v1',
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
    stateTimeline: resolution.stateTimeline,
  };
}

function isIntentPayload(
  value: unknown,
): value is BattleBoardgameMovePayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<BattleBoardgameMovePayloadV1>;
  return (
    typeof payload.requestId === 'string' &&
    payload.requestId.length > 0 &&
    Number.isSafeInteger(payload.round) &&
    payload.round! > 0 &&
    Number.isSafeInteger(payload.checkpointRevision) &&
    payload.checkpointRevision! >= 0 &&
    Boolean(payload.intents) &&
    typeof payload.intents === 'object' &&
    Object.values(payload.intents).every(
      (intent) =>
        Boolean(intent) &&
        typeof intent === 'object' &&
        (intent.kind === 'basic_attack' || intent.kind === 'ability'),
    )
  );
}

function logRejectedMove(
  moveType: string,
  G: BattleBoardgameG,
  playerID: PlayerID | null,
  requestId: string | undefined,
  error: unknown,
  details: Record<string, unknown> = {},
): void {
  console.warn('[battle-server] rejected battle move', {
    moveType,
    matchId: G.matchId,
    playerID,
    requestId,
    round: G.planning?.round ?? G.battle.checkpoint.round,
    matchRevision: G.revision,
    checkpointRevision: G.battle.checkpoint.checkpointRevision,
    reason: error instanceof Error ? error.message : String(error),
    ...details,
  });
}
