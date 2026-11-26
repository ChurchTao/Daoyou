import {
  PARTY_APPLICATION_TTL_MS,
  PartyRecruitmentSourceSchema,
} from '@daoyou/contracts/party';
import { redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';
import { z } from 'zod';

const RESULT_TTL_MS = 24 * 60 * 60 * 1000;
const key = (id: string) => `party:v1:application:${id}`;
const outgoingKey = (userId: string) => `party:v1:applications:user:${userId}`;
const incomingKey = (partyId: string) =>
  `party:v1:applications:party:${partyId}`;

const storedApplication = z.strictObject({
  id: z.uuid(),
  partyId: z.uuid(),
  userId: z.uuid(),
  cultivatorId: z.uuid(),
  partyLabel: z.string(),
  label: z.string(),
  source: PartyRecruitmentSourceSchema,
  status: z.enum([
    'pending',
    'reviewing',
    'accepted',
    'rejected',
    'cancelled',
    'expired',
  ]),
  createdAt: z.number().int(),
  expiresAt: z.number().int(),
});
export type StoredPartyApplication = z.infer<typeof storedApplication>;

function decode(raw: string | null) {
  const result = storedApplication.safeParse(
    parseRedisJson(raw, 'party application'),
  );
  return result.success ? result.data : null;
}

async function readApplications(ids: string[]) {
  if (!ids.length) return [];
  return (await redis.mget(...ids.map(key)))
    .map(decode)
    .filter((row) => row !== null);
}

export async function getPartyApplication(id: string) {
  return decode(await redis.get(key(id)));
}

export function isPendingApplication(
  row: StoredPartyApplication,
  now = Date.now(),
) {
  return row.status === 'pending' && row.expiresAt > now;
}

export async function pendingPartyApplications(userId: string) {
  const now = Date.now();
  const ids = await redis.zrangebyscore(
    outgoingKey(userId),
    now - PARTY_APPLICATION_TTL_MS,
    '+inf',
  );
  return (await readApplications(ids)).filter(
    (row) => row.userId === userId && isPendingApplication(row, now),
  );
}

export async function recentPartyApplications(userId: string) {
  const ids = await redis.zrevrange(outgoingKey(userId), 0, 19);
  return (await readApplications(ids)).filter((row) => row.userId === userId);
}

export async function incomingPartyApplications(partyId: string) {
  const now = Date.now();
  const ids = await redis.zrangebyscore(
    incomingKey(partyId),
    `(${now}`,
    '+inf',
    'LIMIT',
    0,
    40,
  );
  return (await readApplications(ids)).filter(
    (row) => row.partyId === partyId && isPendingApplication(row, now),
  );
}

// Calls which mutate applications serialize by applicant account at the service boundary.
export async function writePartyApplications(
  rows: readonly StoredPartyApplication[],
) {
  if (!rows.length) return;
  const now = Date.now();
  const batch = redis.multi();
  for (const row of rows) {
    const ttl = row.createdAt + RESULT_TTL_MS - now;
    if (ttl <= 0) continue;
    const incoming = incomingKey(row.partyId);
    batch.set(key(row.id), JSON.stringify(row), 'PX', ttl);
    if (isPendingApplication(row, now)) {
      const outgoing = outgoingKey(row.userId);
      batch.zremrangebyscore(outgoing, '-inf', now - RESULT_TTL_MS);
      batch.zadd(outgoing, row.createdAt, row.id);
      batch.pexpire(outgoing, RESULT_TTL_MS);
      batch.zremrangebyscore(incoming, '-inf', now);
      batch.zadd(incoming, row.expiresAt, row.id);
      batch.pexpire(incoming, PARTY_APPLICATION_TTL_MS);
    } else {
      batch.zrem(incoming, row.id);
    }
  }
  const result = await batch.exec();
  if (!result || result.some(([error]) => error))
    throw new Error('无法更新入队申请');
}
