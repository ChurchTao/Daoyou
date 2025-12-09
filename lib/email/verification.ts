import { redis } from '@/lib/redis';

const VERIFICATION_CODE_PREFIX = 'email_verification:';
const RATE_LIMIT_PREFIX = 'email_rate_limit:';
const CODE_EXPIRATION = 600; // 10 minutes in seconds
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const MAX_ATTEMPTS_PER_HOUR = 3;

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store verification code in Redis with expiration
 */
export async function storeVerificationCode(
  email: string,
  code: string,
): Promise<void> {
  const key = `${VERIFICATION_CODE_PREFIX}${email.toLowerCase()}`;
  await redis.setex(key, CODE_EXPIRATION, code);
}

/**
 * Verify code against stored value
 */
export async function verifyCode(
  email: string,
  code: string,
): Promise<boolean> {
  const key = `${VERIFICATION_CODE_PREFIX}${email.toLowerCase()}`;
  const storedCode = await redis.get(key);

  if (!storedCode) {
    return false;
  }
  // string 对比
  return storedCode == code;
}

/**
 * Delete verification code from Redis
 */
export async function deleteVerificationCode(email: string): Promise<void> {
  const key = `${VERIFICATION_CODE_PREFIX}${email.toLowerCase()}`;
  await redis.del(key);
}

/**
 * Check rate limit for email verification requests
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(email: string): Promise<boolean> {
  const key = `${RATE_LIMIT_PREFIX}${email.toLowerCase()}`;
  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) : 0;

  return count < MAX_ATTEMPTS_PER_HOUR;
}

/**
 * Increment rate limit counter for email
 */
export async function incrementRateLimit(email: string): Promise<void> {
  const key = `${RATE_LIMIT_PREFIX}${email.toLowerCase()}`;
  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) : 0;

  await redis.setex(key, RATE_LIMIT_WINDOW, (count + 1).toString());
}

/**
 * Get remaining rate limit attempts
 */
export async function getRemainingAttempts(email: string): Promise<number> {
  const key = `${RATE_LIMIT_PREFIX}${email.toLowerCase()}`;
  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) : 0;

  return Math.max(0, MAX_ATTEMPTS_PER_HOUR - count);
}
