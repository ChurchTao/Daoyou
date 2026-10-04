import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import { getExecutor } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { redis } from '@server/lib/redis/index.js';
import { and, eq } from 'drizzle-orm';
import type { ActiveCultivatorRef, AuthUser } from './types.js';

const ACTIVE_REF_REDIS_TTL_SECONDS = 600;

type CachedActiveCultivatorRef = ActiveCultivatorRef & {
  cachedAt: string;
};

function activeRefCacheKey(userId: string): string {
  return `active-cultivator:user:${userId}`;
}

async function readActiveRefRedisCache(
  userId: string,
): Promise<ActiveCultivatorRef | null> {
  if (!getRuntimeEnvironment().REDIS_URL) {
    return null;
  }

  try {
    const raw = await redis.get(activeRefCacheKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedActiveCultivatorRef;
    if (
      parsed.userId !== userId ||
      !parsed.cultivatorId ||
      parsed.status !== 'active'
    ) {
      return null;
    }

    const ref: ActiveCultivatorRef = {
      userId: parsed.userId,
      cultivatorId: parsed.cultivatorId,
      status: 'active',
    };
    return ref;
  } catch (error) {
    console.warn('[active-cultivator-ref] redis read failed', error);
    return null;
  }
}

async function writeActiveRefRedisCache(ref: ActiveCultivatorRef) {
  if (!getRuntimeEnvironment().REDIS_URL) {
    return;
  }

  try {
    const payload: CachedActiveCultivatorRef = {
      ...ref,
      cachedAt: new Date().toISOString(),
    };
    await redis.set(
      activeRefCacheKey(ref.userId),
      JSON.stringify(payload),
      'EX',
      ACTIVE_REF_REDIS_TTL_SECONDS,
    );
  } catch (error) {
    console.warn('[active-cultivator-ref] redis write failed', error);
  }
}

export async function invalidateActiveCultivatorRef(userId: string) {
  if (!getRuntimeEnvironment().REDIS_URL) {
    return;
  }

  try {
    await redis.del(activeRefCacheKey(userId));
  } catch (error) {
    console.warn('[active-cultivator-ref] redis invalidate failed', error);
  }
}

export async function resolveActiveCultivatorRef(
  user: AuthUser,
): Promise<ActiveCultivatorRef | null> {
  const redisCached = await readActiveRefRedisCache(user.id);
  if (redisCached) {
    return redisCached;
  }

  const executor = getExecutor();
  const row = await executor.query.cultivators.findFirst({
    columns: {
      id: true,
      userId: true,
      status: true,
    },
    where: and(
      eq(cultivators.userId, user.id),
      eq(cultivators.status, 'active'),
    ),
  });

  if (!row) {
    return null;
  }

  const ref: ActiveCultivatorRef = {
    userId: row.userId,
    cultivatorId: row.id,
    status: 'active',
  };
  await writeActiveRefRedisCache(ref);
  return ref;
}
