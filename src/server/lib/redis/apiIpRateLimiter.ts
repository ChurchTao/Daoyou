import { createHash, randomUUID } from 'node:crypto';

import { redis } from './index';

const KEY_PREFIX = 'api:rate-limit:ip';
const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_REQUESTS = 360;

const CHECK_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local windowStart = nowMs - windowMs
redis.call('zremrangebyscore', key, 0, windowStart)

local currentCount = redis.call('zcard', key)
if currentCount >= limit then
  local oldest = redis.call('zrange', key, 0, 0, 'WITHSCORES')
  local oldestScore = tonumber(oldest[2] or nowMs)
  local resetMs = oldestScore + windowMs
  redis.call('pexpire', key, windowMs)
  return {0, currentCount, resetMs}
end

redis.call('zadd', key, nowMs, member)
redis.call('pexpire', key, windowMs)

currentCount = currentCount + 1
local resetMs = nowMs + windowMs
return {1, currentCount, resetMs}
`;

export type ApiIpRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type ApiIpRateLimitOptions = {
  now?: Date;
  windowSeconds?: number;
  maxRequests?: number;
};

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getApiIpRateLimitConfig(options: ApiIpRateLimitOptions = {}) {
  return {
    windowSeconds:
      options.windowSeconds ??
      parsePositiveIntegerEnv(
        'API_IP_RATE_LIMIT_WINDOW_SECONDS',
        DEFAULT_WINDOW_SECONDS,
      ),
    maxRequests:
      options.maxRequests ??
      parsePositiveIntegerEnv(
        'API_IP_RATE_LIMIT_MAX_REQUESTS',
        DEFAULT_MAX_REQUESTS,
      ),
  };
}

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function buildRateLimitKey(ip: string): string {
  return `${KEY_PREFIX}:${hashIdentifier(ip)}`;
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function buildFallbackResult(params: {
  allowed: boolean;
  limit: number;
  used: number;
  resetMs: number;
  nowMs: number;
}): ApiIpRateLimitResult {
  const resetAt = new Date(params.resetMs);
  return {
    allowed: params.allowed,
    limit: params.limit,
    remaining: Math.max(0, params.limit - params.used),
    resetAt,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt.getTime() - params.nowMs) / 1000),
    ),
  };
}

export async function checkApiIpRateLimit(
  ip: string,
  options: ApiIpRateLimitOptions = {},
): Promise<ApiIpRateLimitResult> {
  const { windowSeconds, maxRequests } = getApiIpRateLimitConfig(options);
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const windowMs = windowSeconds * 1000;
  const resetMs = nowMs + windowMs;

  if (!process.env.REDIS_URL) {
    return buildFallbackResult({
      allowed: true,
      limit: maxRequests,
      used: 0,
      resetMs,
      nowMs,
    });
  }

  const rawResult = (await redis.eval(
    CHECK_RATE_LIMIT_SCRIPT,
    1,
    buildRateLimitKey(ip),
    nowMs,
    windowMs,
    maxRequests,
    `${nowMs}:${randomUUID()}`,
  )) as unknown[];

  const allowed = parseCount(rawResult[0]) === 1;
  const used = parseCount(rawResult[1]);
  const rawResetMs = parseCount(rawResult[2]);
  const safeResetMs = rawResetMs > nowMs ? rawResetMs : resetMs;

  return buildFallbackResult({
    allowed,
    limit: maxRequests,
    used,
    resetMs: safeResetMs,
    nowMs,
  });
}
