import {
  createBattleBoardgameGame,
  failBoardgameResolution,
  resolveBoardgameTimeout,
  resumeBoardgameResolution,
  retryBoardgameResolution,
  technicalAbortBoardgameMatch,
  type BattleBoardgameG,
} from '@server/lib/services/BattleBoardgameAdapter';
import { BattleRoster } from '@shared/engine/battle-v5/core/BattleRoster';
import {
  AttributeType,
  type TeamSlot,
} from '@shared/engine/battle-v5/core/types';
import type { BattleMatchPlayerViewV1 } from '@shared/engine/battle-v5/match/types';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '@shared/engine/battle-v5/persistence/BattleStateCodec';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import { BattleRuntime } from '@shared/engine/battle-v5/runtime/BattleRuntime';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { battleBoardgameClientGame } from '@shared/online-battle/BattleBoardgameClientGame';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Server } from 'boardgame.io/server';

function createSave(
  matchId: string,
  teamSize: number | readonly [number, number],
): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const teamSizes =
    typeof teamSize === 'number' ? [teamSize, teamSize] : teamSize;
  const units = ['a', 'b'].flatMap((teamId, teamIndex) =>
    Array.from(
      { length: teamSizes[teamIndex] },
      (_, slot) =>
        new Unit(
          `${teamId}${slot}`,
          `${teamId}${slot}`,
          slot === 0 ? { [AttributeType.SPEED]: 10 } : {},
          { runtime, teamId, slot: slot as TeamSlot },
        ),
    ),
  );
  const roster = new BattleRoster(units);
  const blueprint = createBattleBlueprint(matchId, roster);
  return {
    version: 'battle_save_v1',
    blueprint,
    checkpoint: captureBattleCheckpoint({
      blueprint,
      roster,
      runtime,
      round: 0,
      checkpointRevision: 0,
    }),
  };
}

function runSmoke(
  teamSize: number,
  onePlayerPerUnit: boolean,
  resolveByTimeout = false,
): void {
  runSmokeTeamSizes([teamSize, teamSize], onePlayerPerUnit, resolveByTimeout);
}

function runSmokeTeamSizes(
  teamSizes: readonly [number, number],
  onePlayerPerUnit: boolean,
  resolveByTimeout = false,
): void {
  const label = `${teamSizes[0]}v${teamSizes[1]}`;
  const matchId = `boardgame-smoke-${label}-${resolveByTimeout ? 'timeout' : 'committed'}`;
  const save = createSave(matchId, teamSizes);
  const units = save.blueprint.teams.flatMap((team) =>
    team.units.map((unit) => ({ teamId: team.id, unitId: unit.id })),
  );
  const controllers = onePlayerPerUnit
    ? units.map(({ teamId, unitId }) => ({
        playerId: `p-${unitId}`,
        teamId,
        unitIds: [unitId],
      }))
    : save.blueprint.teams.map((team) => ({
        playerId: `p-${team.id}`,
        teamId: team.id,
        unitIds: team.units.map((unit) => unit.id),
      }));
  const playerIdByBoardgameId = Object.fromEntries(
    controllers.map((controller, index) => [
      String(index),
      controller.playerId,
    ]),
  );
  const game = createBattleBoardgameGame();
  const startedAt = Date.now();
  let G = game.setup?.(null as never, {
    state: {
      version: 'battle_match_state_v1',
      matchId,
      status: 'planning',
      revision: 0,
      processedRequestIds: [],
      battle: save,
      controllers,
      planning: {
        round: 1,
        checkpointRevision: 0,
        deadlineAt: startedAt + 30_000,
        submissions: {},
        committedPlayerIds: [],
      },
      createdAt: 0,
      updatedAt: 0,
    },
    playerIdByBoardgameId,
    acceptedBoardgamePlayerIds: Object.keys(playerIdByBoardgameId),
  }) as BattleBoardgameG;
  const commitConfig = game.phases?.planning?.moves?.commitIntents;
  const commit = (typeof commitConfig === 'function'
    ? commitConfig
    : commitConfig?.move) as unknown as (
    context: { G: BattleBoardgameG; playerID: string },
    payload: {
      requestId: string;
      round: number;
      checkpointRevision: number;
      intents: Record<string, { kind: 'basic_attack'; targetUnitId: string }>;
    },
  ) => BattleBoardgameG;

  if (!commit) {
    throw new Error('Battle boardgame planning moves are missing');
  }

  if (resolveByTimeout) {
    G = resolveBoardgameTimeout(G, startedAt + 30_000);
  } else {
    for (const [playerID, controller] of controllers.entries()) {
      const targetUnitId = units.find(
        (unit) => unit.teamId !== controller.teamId,
      )?.unitId;
      if (!targetUnitId)
        throw new Error('Smoke controller has no enemy target');
      G = commit(
        { G, playerID: String(playerID) },
        {
          requestId: `commit-${controller.playerId}`,
          round: G.planning?.round ?? 0,
          checkpointRevision:
            G.planning?.checkpointRevision ??
            G.battle.checkpoint.checkpointRevision,
          intents: Object.fromEntries(
            controller.unitIds.map((unitId) => [
              unitId,
              { kind: 'basic_attack' as const, targetUnitId },
            ]),
          ),
        },
      );
    }
  }
  if (G.status !== 'resolving' || !G.resolving) {
    throw new Error(`${label} smoke did not persist the sealed command set`);
  }
  if (!resolveByTimeout) {
    const receipts = Object.values(G.commandReceiptsByPlayerId);
    if (
      receipts.length !== controllers.length ||
      receipts.some((receipt) => receipt.status !== 'accepted')
    ) {
      throw new Error(`${label} smoke is missing accepted command receipts`);
    }
  }
  if (label === '1v1') {
    const failed = failBoardgameResolution(
      G,
      new Error('smoke failure'),
      startedAt + 1,
    );
    if (failed.status !== 'resolution_failed' || !failed.resolving?.failure) {
      throw new Error('resolution failure smoke did not freeze the match');
    }
    const retried = retryBoardgameResolution(failed, startedAt + 2);
    if (retried.status !== 'resolving' || retried.resolving?.failure) {
      throw new Error('resolution retry smoke did not restore resolving state');
    }
    const aborted = technicalAbortBoardgameMatch(failed, startedAt + 3);
    if (aborted.status !== 'cancelled' || aborted.resolving) {
      throw new Error('technical abort smoke did not cancel the match');
    }
  }
  G = resumeBoardgameResolution(G, startedAt + 30_001);
  if (G.status !== 'planning' || G.battle.checkpoint.checkpointRevision !== 1) {
    throw new Error(`${label} smoke did not resolve one round`);
  }
  if (G.latestResolution?.round !== 1) {
    throw new Error(`${label} smoke is missing resolution`);
  }
  console.log(
    `battle boardgame ${label} ${resolveByTimeout ? 'timeout' : 'committed'} smoke passed`,
    {
      controllers: controllers.length,
      revision: G.revision,
      checkpointRevision: G.battle.checkpoint.checkpointRevision,
    },
  );
}

runSmoke(2, false);
runSmoke(1, false);
runSmokeTeamSizes([1, 2], true);
runSmokeTeamSizes([2, 4], true);
runSmoke(4, true);
runSmoke(4, true, true);

async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline)
      throw new Error('online boardgame smoke timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function runOnlineSmoke(teamSize: number): Promise<void> {
  const game = createBattleBoardgameGame();
  const matchId = `boardgame-online-smoke-${teamSize}v${teamSize}`;
  const save = createSave(matchId, teamSize);
  const controllers = save.blueprint.teams.flatMap((team) =>
    team.units.map((unit) => ({
      playerId: `p-${unit.id}`,
      teamId: team.id,
      unitIds: [unit.id],
    })),
  );
  const setupData = {
    state: {
      version: 'battle_match_state_v1' as const,
      matchId,
      status: 'planning' as const,
      revision: 0,
      processedRequestIds: [],
      battle: save,
      controllers,
      planning: {
        round: 1,
        checkpointRevision: 0,
        deadlineAt: Date.now() + 30_000,
        submissions: {},
        committedPlayerIds: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    playerIdByBoardgameId: Object.fromEntries(
      controllers.map((controller, index) => [
        String(index),
        controller.playerId,
      ]),
    ),
    acceptedBoardgamePlayerIds: controllers.map((_, index) => String(index)),
  };
  const port = 32_799;
  const server = Server({ games: [game], origins: ['http://localhost'] });
  const servers = await server.run(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const created = await fetch(`${baseUrl}/games/battle-v5-match/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        numPlayers: controllers.length,
        setupData,
        unlisted: true,
      }),
    }).then((response) => response.json() as Promise<{ matchID: string }>);
    const joins = await Promise.all(
      controllers
        .map((_, index) => String(index))
        .map((playerID) =>
          fetch(`${baseUrl}/games/battle-v5-match/${created.matchID}/join`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              playerID,
              playerName: `player-${playerID}`,
            }),
          }).then(
            (response) =>
              response.json() as Promise<{
                playerID: string;
                playerCredentials: string;
              }>,
          ),
        ),
    );
    const clients = joins.map((join) =>
      Client({
        game: battleBoardgameClientGame,
        multiplayer: SocketIO({ server: baseUrl }),
        matchID: created.matchID,
        playerID: join.playerID,
        credentials: join.playerCredentials,
        debug: false,
      }),
    );
    try {
      clients.forEach((client) => client.start());
      await waitUntil(() =>
        clients.every((client) => client.getState()?.isConnected),
      );
      for (const [index, controller] of controllers.entries()) {
        const view = clients[index].getState()?.G as
          BattleMatchPlayerViewV1 | undefined;
        if (!view) throw new Error('Online smoke client has no player view');
        const targetUnitId = save.blueprint.teams.find(
          (team) => team.id !== controller.teamId,
        )?.units[0]?.id;
        if (!targetUnitId)
          throw new Error('Online smoke controller has no enemy target');
        clients[index].moves.commitIntents({
          requestId: `commit-${controller.playerId}`,
          round: view.round,
          checkpointRevision: view.checkpointRevision,
          intents: Object.fromEntries(
            controller.unitIds.map((unitId) => [
              unitId,
              { kind: 'basic_attack', targetUnitId },
            ]),
          ),
        });
      }
      await waitUntil(() => {
        return clients.every((client) => {
          const view = client.getState()?.G as
            BattleMatchPlayerViewV1 | undefined;
          return (
            view?.status === 'resolving' &&
            view.commandReceipt?.status === 'accepted'
          );
        });
      });
      console.log(
        `battle boardgame Socket.IO ${teamSize}v${teamSize} seal smoke passed`,
      );
    } finally {
      clients.forEach((client) => client.stop());
    }
  } finally {
    servers.apiServer?.closeAllConnections();
    servers.appServer.closeAllConnections();
    const socketServer = (
      server.app as typeof server.app & {
        _io?: { close(callback: () => void): void };
      }
    )._io;
    if (socketServer) {
      await new Promise<void>((resolve) => socketServer.close(resolve));
    }
    await Promise.all(
      [servers.apiServer, servers.appServer]
        .filter((entry) => entry !== undefined && entry.listening)
        .map(
          (entry) =>
            new Promise<void>((resolve, reject) => {
              entry.close((error?: Error) =>
                error ? reject(error) : resolve(),
              );
            }),
        ),
    );
  }
}

await runOnlineSmoke(2);
await runOnlineSmoke(4);
