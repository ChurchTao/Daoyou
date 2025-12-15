import { Cultivator } from '@/types/cultivator';
import { redis } from '../redis';

const TEMP_CHAR_TTL = 3600; // 1 hour in seconds
const TEMP_PREFIX = 'temp_cultivator:';
const TEMP_FATES_PREFIX = 'temp_fates:';
const REROLL_COUNT_PREFIX = 'reroll_count:';

/**
 * Save temporary cultivator to Redis
 */
export async function saveTempCharacter(
  cultivator: Cultivator,
): Promise<string> {
  const tempId = crypto.randomUUID();
  const key = `${TEMP_PREFIX}${tempId}`;

  await redis.set(key, JSON.stringify(cultivator), { ex: TEMP_CHAR_TTL });

  return tempId;
}

/**
 * Get temporary cultivator from Redis
 */
export async function getTempCharacter(
  tempId: string,
): Promise<Cultivator | null> {
  const key = `${TEMP_PREFIX}${tempId}`;
  const data = await redis.get<Cultivator>(key);
  return data;
}

/**
 * Save temporary fates to Redis
 */
export async function saveTempFates(
  tempId: string,
  fates: Cultivator['pre_heaven_fates'],
): Promise<void> {
  const key = `${TEMP_FATES_PREFIX}${tempId}`;
  await redis.set(key, JSON.stringify(fates), { ex: TEMP_CHAR_TTL });
}

/**
 * Get temporary fates from Redis
 */
export async function getTempFates(
  tempId: string,
): Promise<Cultivator['pre_heaven_fates'] | null> {
  const key = `${TEMP_FATES_PREFIX}${tempId}`;
  const data = await redis.get<Cultivator['pre_heaven_fates']>(key);
  return data;
}

/**
 * Check and increment reroll count
 * Returns true if reroll is allowed (count < maxRerolls)
 */
export async function checkAndIncrementReroll(
  tempId: string,
  maxRerolls: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${REROLL_COUNT_PREFIX}${tempId}`;
  const count = await redis.incr(key);

  // Set TTL if it's the first increment
  if (count === 1) {
    await redis.expire(key, TEMP_CHAR_TTL);
  }

  // count is 1-based after incr.
  // If maxRerolls is 5, we allow 1, 2, 3, 4, 5.
  // If count is 6, we return false.

  // Actually, the user asked for "regenerate once again", implying initial generation doesn't count as a reroll?
  // Or "regenerate function... each character can regenerate fates 5 times".
  // Let's assume the first manual click is the first reroll.
  // The API will be called for the initial set as well, which might not count as a "reroll".
  // However, for simplicity, we can treat the "generate-fates" API as the "roll" action.
  // We can pass a flag to bypass the check for the FIRST automated call if needed,
  // but simpler to just set detailed logic in the API.
  // Here just purely incr and check.

  if (count > maxRerolls) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRerolls - count };
}

/**
 * Delete all temporary data for a character
 */
export async function deleteTempData(tempId: string): Promise<void> {
  const keys = [
    `${TEMP_PREFIX}${tempId}`,
    `${TEMP_FATES_PREFIX}${tempId}`,
    `${REROLL_COUNT_PREFIX}${tempId}`,
  ];
  await redis.del(...keys);
}
