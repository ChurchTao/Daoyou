import { isRedisConfigured, redis } from './index';

const ACQUIRE_COOLDOWN_SCRIPT = `
local key = KEYS[1]
local cooldownMs = tonumber(ARGV[1])

local acquired = redis.call('set', key, '1', 'PX', cooldownMs, 'NX')
if acquired then
  return {1, 0}
end

local remainingMs = redis.call('pttl', key)
if remainingMs < 0 then
  redis.call('pexpire', key, cooldownMs)
  remainingMs = cooldownMs
end

return {0, remainingMs}
`;

export type RedisCooldownResult = {
  allowed: boolean;
  remainingSeconds: number;
};

export type RedisCooldownOptions = {
  key: string;
  cooldownSeconds: number;
  allowWhenRedisUnavailable?: boolean;
};

function parseRedisInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error('Redis cooldown limiter returned an invalid result');
}

export async function acquireRedisCooldown(
  options: RedisCooldownOptions,
): Promise<RedisCooldownResult> {
  const key = options.key.trim();
  if (!key) {
    throw new Error('Redis cooldown key must not be empty');
  }
  if (
    !Number.isSafeInteger(options.cooldownSeconds) ||
    options.cooldownSeconds <= 0
  ) {
    throw new Error('Redis cooldown seconds must be a positive safe integer');
  }

  if (!isRedisConfigured() && options.allowWhenRedisUnavailable) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const cooldownMs = options.cooldownSeconds * 1000;
  const rawResult = (await redis.eval(
    ACQUIRE_COOLDOWN_SCRIPT,
    1,
    key,
    cooldownMs,
  )) as unknown[];
  const allowed = parseRedisInteger(rawResult[0]) === 1;
  const remainingMs = parseRedisInteger(rawResult[1]);

  return {
    allowed,
    remainingSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}
