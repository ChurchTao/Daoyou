import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockRedisClient = {
  handlers: Map<string, (...args: any[]) => void>;
  disconnect: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
};

const { createRedisClientMock, redisConstructorMock } = vi.hoisted(() => {
  const createRedisClientMock = (): MockRedisClient => {
    const handlers = new Map<string, (...args: any[]) => void>();

    return {
      handlers,
      disconnect: vi.fn(),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers.set(event, handler);
      }),
      ping: vi.fn(),
    };
  };

  return {
    createRedisClientMock,
    redisConstructorMock: vi.fn(),
  };
});

vi.mock('ioredis', () => ({
  default: class RedisMock {
    constructor(...args: unknown[]) {
      return redisConstructorMock(...args);
    }
  },
}));

describe('redis client', () => {
  let currentClient: MockRedisClient;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    currentClient = createRedisClientMock();
    redisConstructorMock.mockImplementation(() => currentClient);

    process.env.REDIS_URL = 'redis://:password@redis-host:6379/0';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it('creates Redis with reconnect, timeout, and keepalive safeguards', async () => {
    const { getRedisClient } = await import('./index');

    expect(getRedisClient()).toBe(currentClient);
    expect(redisConstructorMock).toHaveBeenCalledTimes(1);

    const [redisUrl, options] = redisConstructorMock.mock.calls[0] as [
      string,
      {
        connectTimeout: number;
        commandTimeout: number;
        keepAlive: number;
        lazyConnect: boolean;
        maxRetriesPerRequest: number;
        reconnectOnError: (error: Error) => number | false;
        retryStrategy: (times: number) => number;
        socketTimeout: number;
      },
    ];

    expect(redisUrl).toBe('redis://:password@redis-host:6379/0');
    expect(options).toMatchObject({
      lazyConnect: true,
      connectTimeout: 4_000,
      commandTimeout: 4_000,
      socketTimeout: 30_000,
      keepAlive: 10_000,
      maxRetriesPerRequest: 1,
    });
    expect(options.retryStrategy(1)).toBe(200);
    expect(options.retryStrategy(20)).toBe(2_000);
    expect(options.reconnectOnError(new Error('READONLY replica'))).toBe(2);
    expect(options.reconnectOnError(new Error('boom'))).toBe(false);

    expect(currentClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(currentClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    expect(currentClient.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(currentClient.on).toHaveBeenCalledWith(
      'reconnecting',
      expect.any(Function),
    );
    expect(currentClient.on).toHaveBeenCalledWith('end', expect.any(Function));
    expect(currentClient.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('recreates the singleton client after ioredis gives up reconnecting', async () => {
    const { getRedisClient } = await import('./index');

    const firstClient = getRedisClient();
    currentClient.handlers.get('end')?.();

    const replacementClient = createRedisClientMock();
    currentClient = replacementClient;
    redisConstructorMock.mockImplementation(() => currentClient);

    expect(getRedisClient()).toBe(replacementClient);
    expect(getRedisClient()).not.toBe(firstClient);
    expect(redisConstructorMock).toHaveBeenCalledTimes(2);
  });

  it('resets the singleton client after a timed out command', async () => {
    const { redis } = await import('./index');

    currentClient.ping.mockRejectedValueOnce(new Error('Command timed out'));

    await expect(redis.ping()).rejects.toThrow('Command timed out');
    expect(currentClient.disconnect).toHaveBeenCalledWith(false);

    const replacementClient = createRedisClientMock();
    replacementClient.ping.mockResolvedValueOnce('PONG');
    currentClient = replacementClient;
    redisConstructorMock.mockImplementation(() => currentClient);

    await expect(redis.ping()).resolves.toBe('PONG');
    expect(redisConstructorMock).toHaveBeenCalledTimes(2);
  });

  it('reports Redis health based on configuration and ping result', async () => {
    const { getRedisHealthStatus } = await import('./index');

    currentClient.ping.mockResolvedValueOnce('PONG');
    await expect(getRedisHealthStatus()).resolves.toBe('up');

    currentClient.ping.mockRejectedValueOnce(new Error('timeout'));
    await expect(getRedisHealthStatus()).resolves.toBe('down');

    delete process.env.REDIS_URL;
    await expect(getRedisHealthStatus()).resolves.toBe('disabled');
  });
});
