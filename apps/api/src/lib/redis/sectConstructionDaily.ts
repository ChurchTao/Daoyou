import type { SectConstructionMemberData } from '@daoyou/contracts/sect';
import { redis } from './index.js';

const KEY_PREFIX = 'sect:construction:daily';
const KEY_TTL_SECONDS = 48 * 60 * 60;

export interface SectConstructionDailyRecord {
  requestId: string;
  facilityKey: string;
  spiritStones: number;
  constructionPoints: number;
  contribution: number;
}

function key(userId: string, dateKey: string): string {
  return `${KEY_PREFIX}:${userId}:${dateKey}`;
}

function serialize(record: SectConstructionDailyRecord): string {
  return JSON.stringify(record);
}

function parse(value: string | null): SectConstructionDailyRecord | null {
  if (!value) return null;
  try {
    const record = JSON.parse(value) as Partial<SectConstructionDailyRecord>;
    if (
      typeof record.requestId !== 'string' ||
      typeof record.facilityKey !== 'string' ||
      typeof record.spiritStones !== 'number' ||
      typeof record.constructionPoints !== 'number' ||
      typeof record.contribution !== 'number'
    )
      return null;
    return record as SectConstructionDailyRecord;
  } catch {
    return null;
  }
}

export async function reserveSectConstructionDaily(
  userId: string,
  dateKey: string,
  record: SectConstructionDailyRecord,
): Promise<'created' | 'same' | 'conflict'> {
  const value = serialize(record);
  const result = await redis.set(
    key(userId, dateKey),
    value,
    'EX',
    KEY_TTL_SECONDS,
    'NX',
  );
  if (result === 'OK') return 'created';
  return (await redis.get(key(userId, dateKey))) === value
    ? 'same'
    : 'conflict';
}

export async function releaseSectConstructionDaily(
  userId: string,
  dateKey: string,
  record: SectConstructionDailyRecord,
): Promise<void> {
  await redis.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `,
    1,
    key(userId, dateKey),
    serialize(record),
  );
}

export async function getSectConstructionDailyStatus(
  userId: string,
  dateKey: string,
): Promise<SectConstructionMemberData> {
  const value = await redis.get(key(userId, dateKey));
  const record = parse(value);
  return record
    ? {
        dateKey,
        constructedToday: true,
        facilityKey: record.facilityKey,
        spiritStones: record.spiritStones,
        constructionPoints: record.constructionPoints,
        contribution: record.contribution,
      }
    : { dateKey, constructedToday: value !== null };
}
