import { createBattleBoardgameGame } from './lib/services/BattleBoardgameAdapter';
import { RedisBattleBoardgameStorage } from './lib/services/BattleBoardgameStorage';
import { BattleBoardgameTransport } from './lib/services/BattleBoardgameTransport';
import { publishPendingBattleReplays } from './lib/services/BattleReplayArchivePublisher';
import { Server } from './lib/services/boardgameio-server';
import { timingSafeEqual } from 'node:crypto';
import { closeNatsConnection, getNatsConnection } from './lib/nats';
import { ensureBattleReplayStream } from './lib/mq/natsTopology';

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
const battleTransport = new BattleBoardgameTransport();
const battleServer = Server({
  games: [createBattleBoardgameGame()],
  db: battleStorage,
  transport: battleTransport,
  origins: allowedOrigins,
  // Lobby / match creation API should be private to the matchmaker in
  // production; client traffic uses the Socket.IO transport origin only.
  apiOrigins: apiOrigins.length > 0 ? apiOrigins : ['http://localhost:3000'],
});

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

battleServer.router.post(
  '/internal/battle-matches/:matchID/accept',
  async (context) => {
    const matchID = context.params.matchID;
    const body = await readJsonBody(context.req) as { playerID?: string } | null;
    if (!body?.playerID) {
      context.throw(400, 'playerID is required');
      return;
    }
    await battleStorage.acceptPlayer(matchID, body.playerID);
    context.body = { accepted: true };
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

let timeoutWorkerBackoffUntil = 0;
const runTimeoutWorker = async () => {
  if (Date.now() < timeoutWorkerBackoffUntil) return;
  try {
    for (const matchId of await battleStorage.listExpiredMatchIds()) {
      if (await battleStorage.resolveExpired(matchId)) {
        const next = await battleStorage.fetch(matchId, { state: true });
        battleTransport.publishMatchState(matchId, next.state);
      }
    }
    for (const matchId of await battleStorage.listResolvingMatchIds()) {
      if (await battleStorage.resumeResolving(matchId)) {
        const next = await battleStorage.fetch(matchId, { state: true });
        battleTransport.publishMatchState(matchId, next.state);
      }
    }
    for (const matchId of await battleStorage.listExpiredWaitingMatchIds()) {
      await battleStorage.expireWaiting(matchId);
    }
  } catch (error) {
    timeoutWorkerBackoffUntil = Date.now() + 5_000;
    console.warn('[battle-server] timeout worker failed', { error });
  }
};
const timeoutWorker = setInterval(() => void runTimeoutWorker(), 1_000);
timeoutWorker.unref();

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
