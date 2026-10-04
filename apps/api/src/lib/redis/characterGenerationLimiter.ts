import { createHash } from 'node:crypto';

import {
  CHARACTER_GENERATION_DAILY_LIMIT,
  type CharacterGenerationLimitedBy,
  type CharacterGenerationQuota,
} from '@daoyou/contracts/character-generation';
import { redis } from './index.js';

const KEY_PREFIX = 'character_generation:daily';
const KEY_TTL_SECONDS = 86400;
const RESET_TIMEZONE = 'Asia/Shanghai';

const CONSUME_QUOTA_SCRIPT = `
local emailKey = KEYS[1]
local ipKey = KEYS[2]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local hasIp = ARGV[3] == '1'

local emailCount = tonumber(redis.call('get', emailKey) or '0')
local ipCount = 0

if hasIp then
  ipCount = tonumber(redis.call('get', ipKey) or '0')
end

local emailLimited = emailCount >= limit
local ipLimited = hasIp and ipCount >= limit

if emailLimited or ipLimited then
  return {0, emailCount, ipCount, emailLimited and 1 or 0, ipLimited and 1 or 0}
end

emailCount = redis.call('incr', emailKey)
if emailCount == 1 then
  redis.call('expire', emailKey, ttl)
end

if hasIp then
  ipCount = redis.call('incr', ipKey)
  if ipCount == 1 then
    redis.call('expire', ipKey, ttl)
  end
end

return {1, emailCount, ipCount, 0, 0}
`;

function getDateInResetTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeIp(ip?: string): string | undefined {
  const normalized = ip?.trim();
  return normalized ? normalized : undefined;
}

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function buildDailyKey(kind: 'email' | 'ip', identifier: string): string {
  return `${KEY_PREFIX}:${kind}:${getDateInResetTimezone()}:${hashIdentifier(identifier)}`;
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function resolveLimitedBy(params: {
  remainingByEmail: number;
  remainingByIp: number;
  ipTracked: boolean;
}): CharacterGenerationLimitedBy {
  const { remainingByEmail, remainingByIp, ipTracked } = params;
  const emailLimited = remainingByEmail <= 0;
  const ipLimited = ipTracked && remainingByIp <= 0;

  if (emailLimited && ipLimited) return 'both';
  if (emailLimited) return 'email';
  if (ipLimited) return 'ip';
  return 'none';
}

function buildQuota(params: {
  emailUsed: number;
  ipUsed: number;
  ipTracked: boolean;
}): CharacterGenerationQuota {
  const remainingByEmail = Math.max(
    0,
    CHARACTER_GENERATION_DAILY_LIMIT - params.emailUsed,
  );
  const remainingByIp = params.ipTracked
    ? Math.max(0, CHARACTER_GENERATION_DAILY_LIMIT - params.ipUsed)
    : CHARACTER_GENERATION_DAILY_LIMIT;

  return {
    dailyLimit: CHARACTER_GENERATION_DAILY_LIMIT,
    remaining: Math.min(remainingByEmail, remainingByIp),
    remainingByEmail,
    remainingByIp,
    limitedBy: resolveLimitedBy({
      remainingByEmail,
      remainingByIp,
      ipTracked: params.ipTracked,
    }),
    ipTracked: params.ipTracked,
  };
}

export async function getCharacterGenerationQuota(params: {
  email: string;
  ip?: string;
}): Promise<CharacterGenerationQuota> {
  const email = normalizeEmail(params.email);
  const ip = normalizeIp(params.ip);
  const emailKey = buildDailyKey('email', email);

  if (!ip) {
    const emailUsed = parseCount(await redis.get(emailKey));
    return buildQuota({
      emailUsed,
      ipUsed: 0,
      ipTracked: false,
    });
  }

  const ipKey = buildDailyKey('ip', ip);
  const [emailRaw, ipRaw] = await Promise.all([
    redis.get(emailKey),
    redis.get(ipKey),
  ]);

  return buildQuota({
    emailUsed: parseCount(emailRaw),
    ipUsed: parseCount(ipRaw),
    ipTracked: true,
  });
}

export async function consumeCharacterGenerationQuota(params: {
  email: string;
  ip?: string;
}): Promise<{
  allowed: boolean;
  quota: CharacterGenerationQuota;
}> {
  const email = normalizeEmail(params.email);
  const ip = normalizeIp(params.ip);
  const emailKey = buildDailyKey('email', email);
  const ipKey = ip ? buildDailyKey('ip', ip) : emailKey;
  const rawResult = (await redis.eval(
    CONSUME_QUOTA_SCRIPT,
    2,
    emailKey,
    ipKey,
    CHARACTER_GENERATION_DAILY_LIMIT,
    KEY_TTL_SECONDS,
    ip ? 1 : 0,
  )) as unknown[];

  return {
    allowed: parseCount(rawResult[0]) === 1,
    quota: buildQuota({
      emailUsed: parseCount(rawResult[1]),
      ipUsed: parseCount(rawResult[2]),
      ipTracked: Boolean(ip),
    }),
  };
}
