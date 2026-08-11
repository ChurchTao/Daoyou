import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { AttributeType, type TeamSlot } from '@shared/engine/battle-v5/core/types';
import { BattleRoster } from '@shared/engine/battle-v5/core/BattleRoster';
import { BattleRuntime } from '@shared/engine/battle-v5/runtime/BattleRuntime';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { captureBattleCheckpoint, createBattleBlueprint } from '@shared/engine/battle-v5/persistence/BattleStateCodec';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import { createBattleMatchState, transitionBattleMatch } from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import type { BattleMatchPlayerViewV1, BattleMatchStateV1 } from '@shared/engine/battle-v5/match/types';
import { battleBoardgameClientGame } from '@shared/online-battle/BattleBoardgameClientGame';
import {
  battleOnlineMatchKey,
  RedisBattleBoardgameStorage,
} from '@server/lib/services/BattleBoardgameStorage';
import type { BattleBoardgameG } from '@server/lib/services/BattleBoardgameAdapter';
import { redis } from '@server/lib/redis';

const port = Number(process.env.BATTLE_RESTART_E2E_PORT ?? 3120);
const baseUrl = `http://127.0.0.1:${port}`;
const token = process.env.BATTLE_SERVER_API_TOKEN ?? 'restart-e2e-token';
const gameName = 'battle-v5-match';

function makeState(matchId: string): BattleMatchStateV1 {
  const runtime = new BattleRuntime();
  const units = ['a', 'b'].flatMap((teamId) =>
    Array.from({ length: 2 }, (_, slot) => new Unit(
      `${teamId}${slot}`, `${teamId}${slot}`,
      slot === 0 ? { [AttributeType.SPEED]: 10 } : {},
      { runtime, teamId, slot: slot as TeamSlot },
    )),
  );
  const roster = new BattleRoster(units);
  const blueprint = createBattleBlueprint(matchId, roster);
  const save: BattleSaveV1 = {
    version: 'battle_save_v1',
    blueprint,
    checkpoint: captureBattleCheckpoint({ blueprint, roster, runtime, round: 0, checkpointRevision: 0 }),
  };
  runtime.dispose();
  return createBattleMatchState({
    matchId, battle: save,
    controllers: save.blueprint.teams.flatMap((team) => team.units.map((unit) => ({
      playerId: `restart-${unit.id}`, teamId: team.id, unitIds: [unit.id],
    }))),
    now: Date.now(), planningTimeoutMs: 30_000,
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => null) as T & { error?: string } | null;
  if (!response.ok) throw new Error(`${response.status}: ${body?.error ?? 'request failed'}`);
  return body as T;
}

async function waitUntil(check: () => Promise<boolean> | boolean, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() >= deadline) throw new Error('restart e2e wait timed out');
    await Bun.sleep(100);
  }
}

function spawnServer() {
  return Bun.spawn(['node', 'dist-battle/battle-server.js'], {
    env: {
      ...process.env,
      BATTLE_SERVER_PORT: String(port),
      BATTLE_SERVER_API_TOKEN: token,
      BATTLE_SERVER_ORIGINS: 'http://localhost:5173',
      BATTLE_SERVER_API_ORIGINS: 'http://localhost:3000',
      BATTLE_SERVER_PUBLIC_ORIGIN: baseUrl,
      NODE_ENV: 'development',
    },
    stdout: 'inherit', stderr: 'inherit',
  });
}

let server = spawnServer();
async function stopServer(processHandle: ReturnType<typeof spawnServer>) {
  processHandle.kill(9);
  await Promise.race([processHandle.exited, Bun.sleep(1_000)]);
}
try {
  await waitUntil(async () => (await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(500) }).catch(() => null))?.ok === true, 15_000);
  const initial = makeState(`restart-fixture-${Date.now()}`);
  const mapping = Object.fromEntries(initial.controllers.map((controller, index) => [String(index), controller.playerId]));
  const created = await request<{ matchID: string }>(`/games/${gameName}/create`, {
    method: 'POST', body: JSON.stringify({ numPlayers: initial.controllers.length, unlisted: true, setupData: { state: initial, playerIdByBoardgameId: mapping, acceptedBoardgamePlayerIds: [] } }),
  });
  const joined: { playerID: string; playerCredentials: string }[] = [];
  for (const [index, controller] of initial.controllers.entries()) {
    joined.push(await request(`/games/${gameName}/${created.matchID}/join`, {
      method: 'POST', body: JSON.stringify({ playerID: String(index), playerName: controller.playerId }),
    }));
  }

  const resolvingSeed = makeState(created.matchID);
  // Keep one enemy at 1 HP so timeout intent sealing still has a legal target;
  // the first faster alpha action then finishes the battle after restart.
  const nearDefeatedBeta = {
    ...resolvingSeed,
    battle: {
      ...resolvingSeed.battle,
      checkpoint: {
        ...resolvingSeed.battle.checkpoint,
        units: Object.fromEntries(Object.entries(resolvingSeed.battle.checkpoint.units).map(
          ([unitId, unit]) => [
            unitId,
            unitId === 'b0'
              ? { ...unit, hp: 1 }
              : unitId === 'b1'
                ? { ...unit, hp: 0 }
                : unit,
          ],
        )),
      },
    },
  };
  const resolving = transitionBattleMatch(nearDefeatedBeta, {
    type: 'resolve_planning_timeout', matchId: created.matchID, requestId: 'restart-fixture-timeout',
    expectedMatchRevision: 0, expectedCheckpointRevision: 0,
  }, Date.now() + 31_000).state;
  const storage = new RedisBattleBoardgameStorage();
  const stored = await storage.fetch(created.matchID, { state: true });
  if (!stored.state) throw new Error('boardgame state was not persisted in Redis');
  const currentGame = stored.state;
  const currentG = currentGame.G as BattleBoardgameG;
  const resolvingGame = {
    ...currentGame,
    G: {
      ...resolving,
      playerIdByBoardgameId: mapping,
      acceptedBoardgamePlayerIds: Object.keys(mapping),
      commandReceiptsByPlayerId: currentG.commandReceiptsByPlayerId,
      replay: currentG.replay,
    },
    _stateID: currentGame._stateID + 1,
  };
  await storage.setState(created.matchID, resolvingGame);

  await stopServer(server);
  server = spawnServer();
  await waitUntil(async () => (await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(500) }).catch(() => null))?.ok === true, 15_000);
  const client = Client({ game: battleBoardgameClientGame, multiplayer: SocketIO({ server: baseUrl }), matchID: created.matchID, playerID: joined[0]!.playerID, credentials: joined[0]!.playerCredentials, debug: false });
  try {
    client.start();
    await waitUntil(() => client.getState()?.isConnected === true, 10_000);
    await waitUntil(() => {
      const view = client.getState()?.G as BattleMatchPlayerViewV1 | undefined;
      return view?.status === 'finished' && view.latestResolution?.round === 1;
    }, 10_000);
  } finally { client.stop(); }
  await waitUntil(async () => (
    await redis.hget(battleOnlineMatchKey(created.matchID), 'archive_status')
  ) === 'published', 10_000);
  const archive = JSON.parse(
    await redis.hget(battleOnlineMatchKey(created.matchID), 'archive') ?? 'null',
  ) as { version?: string; outcome?: { battleEnded?: boolean }; rounds?: unknown[] } | null;
  if (
    archive?.version !== 'battle_replay_v1' ||
    archive.outcome?.battleEnded !== true ||
    archive.rounds?.length !== 1
  ) {
    throw new Error('finished battle replay was not published through NATS');
  }
  await storage.wipe(created.matchID);
  console.log('battle Redis restart and NATS replay publish passed', { matchID: created.matchID });
} finally {
  await stopServer(server);
}
process.exit(0);
