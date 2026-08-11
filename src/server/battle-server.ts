import { createBattleBoardgameGame } from './lib/services/BattleBoardgameAdapter';
import { RedisBattleBoardgameStorage } from './lib/services/BattleBoardgameStorage';
import { BattleBoardgameTransport } from './lib/services/BattleBoardgameTransport';
import { publishPendingBattleReplays } from './lib/services/BattleReplayArchivePublisher';
import { Server } from './lib/services/boardgameio-server';
import { timingSafeEqual } from 'node:crypto';
import { closeNatsConnection, getNatsConnection } from './lib/nats';
import { ensureBattleReplayStream } from './lib/mq/natsTopology';
import { BattleMatchCoordinator } from './lib/services/BattleMatchCoordinator';

const port = Number(process.env.BATTLE_SERVER_PORT ?? 3100);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error('BATTLE_SERVER_PORT must be a valid TCP port');
}

const origins = (process.env.BATTLE_SERVER_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (origins.length === 0 && process.env.NODE_ENV === 'production') {
  throw new Error('BATTLE_SERVER_ORIGINS is required in production');
}
const allowedOrigins = origins.length > 0 ? origins : ['http://localhost:5173'];
const apiOrigins = (process.env.BATTLE_SERVER_API_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (apiOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  throw new Error('BATTLE_SERVER_API_ORIGINS is required in production');
}
const apiToken = process.env.BATTLE_SERVER_API_TOKEN?.trim() ?? '';
if (!apiToken && process.env.NODE_ENV === 'production') {
  throw new Error('BATTLE_SERVER_API_TOKEN is required in production');
}

const battleStorage = new RedisBattleBoardgameStorage();
await battleStorage.connect();
await getNatsConnection();
await ensureBattleReplayStream();
const battleTransport = new BattleBoardgameTransport(async (conflict) => {
  console.warn('[battle-server] move lost Redis CAS', {
    code: conflict.code,
    matchId: conflict.matchID,
  });
  try {
    const latest = await battleStorage.fetch(conflict.matchID, { state: true });
    battleTransport.publishMatchState(conflict.matchID, latest.state);
  } catch (error) {
    console.warn('[battle-server] failed to resync after Redis CAS conflict', {
      matchId: conflict.matchID,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
const battleServer = Server({
  games: [createBattleBoardgameGame()],
  db: battleStorage,
  transport: battleTransport,
  origins: allowedOrigins,
  // Lobby / match creation API should be private to the matchmaker in
  // production; client traffic uses the Socket.IO transport origin only.
  apiOrigins: apiOrigins.length > 0 ? apiOrigins : ['http://localhost:3000'],
});
const battleCoordinator = new BattleMatchCoordinator(battleStorage, battleTransport);

battleServer.router.get(
  '/internal/battle-matches/:matchID/session',
  async (context) => {
    const matchID = context.params.matchID;
    const applicationPlayerId = Array.isArray(context.query.playerId)
      ? context.query.playerId[0]
      : context.query.playerId;
    if (!applicationPlayerId) {
      context.throw(400, 'playerId is required');
      return;
    }
    const session = await battleStorage.getPlayerSession(
      matchID,
      applicationPlayerId,
    );
    if (!session) context.throw(404, 'Battle player session not found');
    context.body = session;
  },
);

battleServer.router.get(
  '/internal/battle-matches/find-arena',
  async (context) => {
    const roomId = Array.isArray(context.query.roomId)
      ? context.query.roomId[0]
      : context.query.roomId;
    const startRequestId = Array.isArray(context.query.startRequestId)
      ? context.query.startRequestId[0]
      : context.query.startRequestId;
    if (!roomId || !startRequestId) {
      context.throw(400, 'roomId and startRequestId are required');
      return;
    }
    context.body = {
      matchID: await battleStorage.findArenaMatch(roomId, startRequestId),
    };
  },
);

battleServer.router.post(
  '/internal/battle-matches/:matchID/accept',
  async (context) => {
    const matchID = context.params.matchID;
    const body = await readJsonBody(context.req) as { playerID?: string } | null;
    if (!body?.playerID) {
      context.throw(400, 'playerID is required');
      return;
    }
    const accepted = await battleCoordinator.acceptPlayer(matchID, body.playerID);
    context.body = { accepted: accepted !== undefined };
  },
);

battleServer.router.post(
  '/internal/battle-matches/:matchID/resolution/retry',
  async (context) => {
    const matchID = context.params.matchID;
    const retried = await battleCoordinator.retryResolution(matchID);
    context.body = { retried: Boolean(retried) };
  },
);

battleServer.router.post(
  '/internal/battle-matches/:matchID/technical-abort',
  async (context) => {
    const matchID = context.params.matchID;
    const aborted = await battleCoordinator.technicalAbort(matchID);
    context.body = { aborted: Boolean(aborted) };
  },
);

// The boardgame.io Lobby API can create matches and issue player credentials.
// CORS is only a browser policy, so these routes also require service auth.
battleServer.app.use(async (context, next) => {
  if (context.path === '/healthz') {
    context.body = { ok: true };
    return;
  }
  if (
    (context.path.startsWith('/games') ||
      context.path.startsWith('/internal/battle-matches/')) &&
    apiToken &&
    !matchesBearerToken(context.get('authorization'), apiToken)
  ) {
    context.status = 401;
    context.body = { error: 'Unauthorized battle-server API request' };
    return;
  }
  await next();
});

const servers = await battleServer.run(port, () => {
  console.info(`[battle-server] listening on ${port}`);
});

const DEADLINE_RECONCILE_INTERVAL_MS = 5_000;
const DEADLINE_RECONCILE_BATCH_SIZE = 100;
let deadlineReconcileCursor = '0';
let deadlineReconcileAt = 0;
let timeoutWorkerRunning = false;

const runTimeoutWorker = async () => {
  if (timeoutWorkerRunning) return;
  timeoutWorkerRunning = true;
  try {
    const now = Date.now();
    if (now >= deadlineReconcileAt) {
      const page = await battleStorage.scanMatchIds(
        deadlineReconcileCursor,
        DEADLINE_RECONCILE_BATCH_SIZE,
      );
      deadlineReconcileCursor = page.cursor;
      deadlineReconcileAt = Date.now() + DEADLINE_RECONCILE_INTERVAL_MS;
      for (const matchId of page.matchIds) {
        await runIsolatedMatchTask(matchId, 'reconcile_deadline', async () => {
          await battleCoordinator.reconcileDeadlineIndex(matchId);
        });
      }
    }
    for (const matchId of await battleStorage.listExpiredMatchIds()) {
      await runIsolatedMatchTask(matchId, 'resolve_expired', async () => {
        await battleCoordinator.resolveExpired(matchId);
      });
    }
    for (const matchId of await battleStorage.listResolvingMatchIds()) {
      await runIsolatedMatchTask(matchId, 'resume_resolving', async () => {
        await battleCoordinator.resumeResolving(matchId);
      });
    }
    for (const matchId of await battleStorage.listExpiredWaitingMatchIds()) {
      await runIsolatedMatchTask(matchId, 'expire_waiting', () =>
        battleCoordinator.expireWaiting(matchId).then(() => undefined));
    }
  } catch (error) {
    console.warn('[battle-server] timeout worker scan failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    timeoutWorkerRunning = false;
  }
};

async function runIsolatedMatchTask(
  matchId: string,
  operation:
    | 'reconcile_deadline'
    | 'resolve_expired'
    | 'resume_resolving'
    | 'expire_waiting',
  task: () => Promise<void>,
): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.warn('[battle-server] isolated match task failed', {
      matchId,
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
const timeoutWorker = setInterval(() => void runTimeoutWorker(), 1_000);
timeoutWorker.unref();
void runTimeoutWorker();

let archivePublisherBackoffUntil = 0;
const runArchivePublisher = async () => {
  if (Date.now() < archivePublisherBackoffUntil) return;
  try {
    await publishPendingBattleReplays(battleStorage);
  } catch (error) {
    archivePublisherBackoffUntil = Date.now() + 5_000;
    console.warn('[battle-server] replay archive publish failed', { error });
  }
};
const archivePublisher = setInterval(() => void runArchivePublisher(), 250);
archivePublisher.unref();
void runArchivePublisher();

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info('[battle-server] shutting down', { signal });
  clearInterval(timeoutWorker);
  clearInterval(archivePublisher);
  battleServer.kill(servers);
  await closeNatsConnection();
}

async function readJsonBody(request: NodeJS.ReadableStream): Promise<unknown | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 4_096) throw new Error('Battle internal request body is too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

function matchesBearerToken(authorization: string, expected: string): boolean {
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) return false;
  const actualBuffer = Buffer.from(authorization.slice(prefix.length));
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
