import type { DbExecutor } from '@server/lib/drizzle/db.js';
import { baixiaoEntries } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';

export const baixiaoDuelKey = (id: string) => `baixiao:duel:${id}`;

export async function hasBaixiaoBattle(cultivatorId: string, q: DbExecutor) {
  const [entry] = await q
    .select({ id: baixiaoEntries.challengeId, endsAt: baixiaoEntries.endsAt })
    .from(baixiaoEntries)
    .where(
      and(
        eq(baixiaoEntries.cultivatorId, cultivatorId),
        isNotNull(baixiaoEntries.challengeId),
      ),
    )
    .orderBy(desc(baixiaoEntries.endsAt))
    .limit(1);
  if (!entry?.id) return false;
  if (entry.endsAt.getTime() > Date.now()) return true;
  const key = baixiaoDuelKey(entry.id);
  const duel = parseRedisJson<{ completedAt?: number }>(
    await redis.get(key),
    key,
  );
  return (
    duel?.completedAt !== undefined && duel.completedAt < entry.endsAt.getTime()
  );
}
