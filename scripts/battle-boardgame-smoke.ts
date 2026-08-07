import { BattleRoster } from '@shared/engine/battle-v5/core/BattleRoster';
import { AttributeType, type TeamSlot } from '@shared/engine/battle-v5/core/types';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '@shared/engine/battle-v5/persistence/BattleStateCodec';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import { BattleRuntime } from '@shared/engine/battle-v5/runtime/BattleRuntime';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import {
  createBattleBoardgameGame,
  resolveBoardgameTimeout,
  type BattleBoardgameG,
} from '@server/lib/services/BattleBoardgameAdapter';
import { Server } from 'boardgame.io/server';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import type { BattleMatchPlayerViewV1 } from '@shared/engine/battle-v5/match/types';
import { battleBoardgameClientGame } from '@shared/online-battle/BattleBoardgameClientGame';

function createSave(matchId: string, teamSize: number): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const units = ['a', 'b'].flatMap((teamId) =>
    Array.from({ length: teamSize }, (_, slot) =>
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
  const matchId = `boardgame-smoke-${teamSize}v${teamSize}-${resolveByTimeout ? 'timeout' : 'locked'}`;
  const save = createSave(matchId, teamSize);
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
    controllers.map((controller, index) => [String(index), controller.playerId]),
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
        lockedPlayerIds: [],
      },
      createdAt: 0,
      updatedAt: 0,
    },
    playerIdByBoardgameId,
  }) as BattleBoardgameG;
  const submitConfig = game.phases?.planning?.moves?.submitIntent;
  const submit = (typeof submitConfig === 'function'
    ? submitConfig
    : submitConfig?.move) as unknown as (
    context: { G: BattleBoardgameG; playerID: string },
    payload: { requestId: string; unitId: string; intent: { kind: 'pass' } },
  ) => BattleBoardgameG;
  const lockConfig = game.phases?.planning?.moves?.lockPlayer;
  const lock = (typeof lockConfig === 'function'
    ? lockConfig
    : lockConfig?.move) as unknown as (
    context: { G: BattleBoardgameG; playerID: string },
    payload: { requestId: string },
  ) => BattleBoardgameG;

  if (!submit || !lock) {
    throw new Error('Battle boardgame planning moves are missing');
  }

  if (resolveByTimeout) {
    G = resolveBoardgameTimeout(G, startedAt + 30_000);
  } else {
    for (const { unitId } of units) {
      const controllerIndex = controllers.findIndex((controller) =>
        controller.unitIds.includes(unitId),
      );
      G = submit(
        { G, playerID: String(controllerIndex) },
        { requestId: `intent-${unitId}`, unitId, intent: { kind: 'pass' } },
      );
    }
    for (const [playerID, controller] of controllers.entries()) {
      G = lock(
        { G, playerID: String(playerID) },
        { requestId: `lock-${controller.playerId}` },
      );
    }
  }
  if (G.status !== 'planning' || G.battle.checkpoint.checkpointRevision !== 1) {
    throw new Error(`${teamSize}v${teamSize} smoke did not resolve one round`);
  }
  if (G.latestResolution?.round !== 1) {
    throw new Error(`${teamSize}v${teamSize} smoke is missing resolution`);
  }
  console.log(`battle boardgame ${teamSize}v${teamSize} ${resolveByTimeout ? 'timeout' : 'locked'} smoke passed`, {
    controllers: controllers.length,
    revision: G.revision,
    checkpointRevision: G.battle.checkpoint.checkpointRevision,
  });
}

runSmoke(2, false);
runSmoke(4, true);
runSmoke(4, true, true);

async function waitUntil(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('online boardgame smoke timed out');
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
        lockedPlayerIds: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    playerIdByBoardgameId: Object.fromEntries(
      controllers.map((controller, index) => [String(index), controller.playerId]),
    ),
  };
  const port = 32_799;
  const server = Server({ games: [game], origins: ['http://localhost'] });
  const servers = await server.run(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const created = await fetch(`${baseUrl}/games/battle-v5-match/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ numPlayers: controllers.length, setupData, unlisted: true }),
    }).then((response) => response.json() as Promise<{ matchID: string }>);
    const joins = await Promise.all(
      controllers.map((_, index) => String(index)).map((playerID) =>
        fetch(`${baseUrl}/games/battle-v5-match/${created.matchID}/join`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ playerID, playerName: `player-${playerID}` }),
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
      await waitUntil(() => clients.every((client) => client.getState()?.isConnected));
      for (const [index, controller] of controllers.entries()) {
        for (const unitId of controller.unitIds) {
          clients[index].moves.submitIntent({
            requestId: `intent-${unitId}`,
            unitId,
            intent: { kind: 'pass' },
          });
        }
      }
      for (const [index, controller] of controllers.entries()) {
        clients[index].moves.lockPlayer({ requestId: `lock-${controller.playerId}` });
      }
      await waitUntil(() => {
        const view = clients[0].getState()?.G as BattleMatchPlayerViewV1 | undefined;
        return view?.latestResolution?.round === 1;
      });
      console.log(`battle boardgame Socket.IO ${teamSize}v${teamSize} smoke passed`);
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
              entry.close((error?: Error) => (error ? reject(error) : resolve()));
            }),
        ),
    );
  }
}

await runOnlineSmoke(2);
await runOnlineSmoke(4);
