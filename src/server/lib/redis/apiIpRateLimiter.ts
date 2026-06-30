import { redis } from './index';

const KEY_PREFIX = 'api:rate-limit:ip';
const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_REQUESTS = 300;
const TOKEN_SCALE = 1000;

const CHECK_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local tokenScale = tonumber(ARGV[4])
local capacityUnits = capacity * tokenScale

local bucket = redis.call('hmget', key, 'tokens', 'updatedAtMs')
local tokens = tonumber(bucket[1])
local updatedAtMs = tonumber(bucket[2])

if tokens == nil or updatedAtMs == nil then
  tokens = capacityUnits
  updatedAtMs = nowMs
else
  local elapsedMs = math.max(0, nowMs - updatedAtMs)
  if elapsedMs > 0 then
    local refillUnits = math.floor((elapsedMs * capacityUnits) / windowMs)
    tokens = math.min(capacityUnits, tokens + refillUnits)
    updatedAtMs = nowMs
  end
end

local allowed = 0
if tokens >= tokenScale then
  tokens = tokens - tokenScale
  allowed = 1
end

local remaining = math.floor(tokens / tokenScale)
local missingForOne = math.max(0, tokenScale - tokens)
local retryAfterMs = 0
if allowed == 0 then
  retryAfterMs = math.ceil((missingForOne * windowMs) / capacityUnits)
end

local fullRecoveryMs = math.ceil(((capacityUnits - tokens) * windowMs) / capacityUnits)
local resetMs = nowMs + fullRecoveryMs
local ttlMs = math.max(1000, fullRecoveryMs * 2)

redis.call('hmset', key, 'tokens', tokens, 'updatedAtMs', updatedAtMs)
redis.call('pexpire', key, ttlMs)

return {allowed, remaining, resetMs, retryAfterMs}
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

function buildRateLimitKey(ip: string): string {
  return `${KEY_PREFIX}:${ip}`;
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
  remaining: number;
  resetMs: number;
  retryAfterMs?: number;
  nowMs: number;
}): ApiIpRateLimitResult {
  const resetAt = new Date(params.resetMs);
  return {
    allowed: params.allowed,
    limit: params.limit,
    remaining: Math.max(0, Math.min(params.limit, params.remaining)),
    resetAt,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(
        (params.retryAfterMs ?? resetAt.getTime() - params.nowMs) / 1000,
      ),
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
      remaining: maxRequests,
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
    TOKEN_SCALE,
  )) as unknown[];

  const allowed = parseCount(rawResult[0]) === 1;
  const remaining = parseCount(rawResult[1]);
  const rawResetMs = parseCount(rawResult[2]);
  const retryAfterMs = parseCount(rawResult[3]);
  const safeResetMs = rawResetMs > nowMs ? rawResetMs : resetMs;

  return buildFallbackResult({
    allowed,
    limit: maxRequests,
    remaining,
    resetMs: safeResetMs,
    retryAfterMs,
    nowMs,
  });
}
