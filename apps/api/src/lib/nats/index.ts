import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import {
  connect,
  deadline,
  type JetStreamClient,
  type JetStreamManager,
  type NatsConnection,
} from 'nats';
import { hostname } from 'node:os';

const NATS_CONNECT_TIMEOUT_MS = 5_000;

let connectionPromise: Promise<NatsConnection> | undefined;

function requiredNatsConfig() {
  const servers = getRuntimeEnvironment().NATS_SERVERS?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  const user = getRuntimeEnvironment().NATS_USER?.trim();
  const pass = getRuntimeEnvironment().NATS_PASSWORD;

  if (!servers?.length) throw new Error('NATS_SERVERS is required');
  if (!user) throw new Error('NATS_USER is required');
  if (!pass) throw new Error('NATS_PASSWORD is required');

  return { servers, user, pass };
}

async function createNatsConnection(): Promise<NatsConnection> {
  const config = requiredNatsConfig();
  const connection = await connect({
    ...config,
    name:
      getRuntimeEnvironment().NATS_CLIENT_NAME ?? `daoyou-api-${hostname()}-${process.pid}`,
    timeout: NATS_CONNECT_TIMEOUT_MS,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1_000,
    pingInterval: 20_000,
    maxPingOut: 2,
  });

  console.info('[nats] connected', { server: connection.getServer() });
  void monitorNatsConnection(connection);
  return connection;
}

async function monitorNatsConnection(connection: NatsConnection) {
  for await (const status of connection.status()) {
    if (status.type === 'disconnect' || status.type === 'error') {
      console.warn('[nats] connection status', status);
    } else if (status.type === 'reconnect') {
      console.info('[nats] reconnected', { server: connection.getServer() });
    }
  }
}

export function getNatsConnection(): Promise<NatsConnection> {
  if (!connectionPromise) {
    const pending = createNatsConnection();
    connectionPromise = pending;
    void pending.then(
      async (connection) => {
        const error = await connection.closed();
        if (connectionPromise === pending) connectionPromise = undefined;
        if (error) {
          console.warn('[nats] connection closed', { error });
        }
      },
      () => {
        if (connectionPromise === pending) connectionPromise = undefined;
      },
    );
  }
  return connectionPromise;
}

export async function getJetStreamClient(): Promise<JetStreamClient> {
  return (await getNatsConnection()).jetstream();
}

export async function getJetStreamManager(): Promise<JetStreamManager> {
  return (await getNatsConnection()).jetstreamManager();
}

export async function getNatsHealthStatus(): Promise<'up' | 'down'> {
  try {
    const connection = await getNatsConnection();
    if (connection.isClosed() || connection.isDraining()) return 'down';
    await deadline(connection.flush(), 2_000);
    return 'up';
  } catch {
    return 'down';
  }
}

export async function closeNatsConnection(): Promise<void> {
  const pending = connectionPromise;
  connectionPromise = undefined;
  if (!pending) return;

  try {
    const connection = await pending;
    if (!connection.isClosed()) await connection.drain();
  } catch (error) {
    console.error('[nats] drain failed', error);
  }
}
