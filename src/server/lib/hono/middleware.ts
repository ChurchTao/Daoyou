import { auth } from '@server/lib/auth/auth';
import type { AuthUser } from '@server/lib/auth/types';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import type { ActiveCultivatorRef, AppEnv } from '@server/lib/hono/types';
import { redis } from '@server/lib/redis';
import { and, eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { ZodError, type ZodType } from 'zod';

const ACTIVE_REF_MEMORY_TTL_MS = 45_000;
const ACTIVE_REF_REDIS_TTL_SECONDS = 600;

type CachedActiveCultivatorRef = ActiveCultivatorRef & {
  cachedAt: string;
};

const activeRefMemoryCache = new Map<
  string,
  { value: CachedActiveCultivatorRef; expiresAt: number }
>();

function activeRefCacheKey(userId: string): string {
  return `active-cultivator:user:${userId}`;
}

function readActiveRefMemoryCache(
  userId: string,
): ActiveCultivatorRef | null {
  const cached = activeRefMemoryCache.get(userId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    activeRefMemoryCache.delete(userId);
    return null;
  }

  return {
    userId: cached.value.userId,
    cultivatorId: cached.value.cultivatorId,
    status: cached.value.status,
  };
}

function writeActiveRefMemoryCache(ref: ActiveCultivatorRef) {
  activeRefMemoryCache.set(ref.userId, {
    value: { ...ref, cachedAt: new Date().toISOString() },
    expiresAt: Date.now() + ACTIVE_REF_MEMORY_TTL_MS,
  });
}

async function readActiveRefRedisCache(
  userId: string,
): Promise<ActiveCultivatorRef | null> {
  if (!process.env.REDIS_URL) {
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
    writeActiveRefMemoryCache(ref);
    return ref;
  } catch (error) {
    console.warn('[active-cultivator-ref] redis read failed', error);
    return null;
  }
}

async function writeActiveRefRedisCache(ref: ActiveCultivatorRef) {
  if (!process.env.REDIS_URL) {
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
  activeRefMemoryCache.delete(userId);
  if (!process.env.REDIS_URL) {
    return;
  }

  try {
    await redis.del(activeRefCacheKey(userId));
  } catch (error) {
    console.warn('[active-cultivator-ref] redis invalidate failed', error);
  }
}

async function resolveActiveCultivatorRef(
  user: AuthUser,
): Promise<ActiveCultivatorRef | null> {
  const memoryCached = readActiveRefMemoryCache(user.id);
  if (memoryCached) {
    return memoryCached;
  }

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
  writeActiveRefMemoryCache(ref);
  await writeActiveRefRedisCache(ref);
  return ref;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function applyAuthHeaders(context: Context<AppEnv>, headers?: Headers | null) {
  if (!headers) {
    return;
  }

  headers.forEach((value, key) => {
    context.header(key, value, {
      append: key.toLowerCase() === 'set-cookie',
    });
  });
}

async function resolveUser(context: Context<AppEnv>): Promise<AuthUser | null> {
  const existingUser = context.get('user');

  if (existingUser) {
    return existingUser;
  }

  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
    returnHeaders: true,
  });

  applyAuthHeaders(context, session.headers);

  if (!session.response?.user) {
    return null;
  }

  return {
    id: session.response.user.id,
    email: session.response.user.email,
    name: session.response.user.name,
  };
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function errorBody(
  message: string,
  status = 500,
  details?: unknown,
): Response {
  const body: { success: false; error: string; details?: unknown } = {
    success: false,
    error: message,
  };

  if (process.env.NODE_ENV === 'development' && details) {
    body.details = details instanceof Error ? details.message : details;
  }

  return Response.json(body, { status });
}

export function jsonError(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        context.res = Response.json(
          {
            success: false,
            error: error.issues[0]?.message || '参数错误',
            details: error.issues,
          },
          { status: 400 },
        );
        return;
      }

      console.error('Unhandled API error:', error);
      context.res = errorBody(toErrorMessage(error, '服务器内部错误'), 500, error);
    }
  };
}

export function requireUser(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const user = await resolveUser(context);

    if (!user) {
      context.res = errorBody('未授权访问', 401);
      return;
    }

    context.set('user', user);
    await next();
  };
}

export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const user = await resolveUser(context);

    if (!user) {
      context.res = errorBody('未授权访问', 401);
      return;
    }

    if (!isAdminEmail(user.email)) {
      context.res = errorBody('无管理员权限', 403);
      return;
    }

    context.set('user', user);
    await next();
  };
}

export function requireActiveCultivator(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const user = context.get('user') ?? (await resolveUser(context));

    if (!user) {
      context.res = errorBody('未授权访问', 401);
      return;
    }

    const executor = getExecutor();
    const cultivator = await executor.query.cultivators.findFirst({
      where: and(
        eq(cultivators.userId, user.id),
        eq(cultivators.status, 'active'),
      ),
    });

    if (!cultivator) {
      context.res = errorBody('当前没有活跃角色', 404);
      return;
    }

    context.set('user', user);
    context.set('activeCultivatorRef', {
      userId: user.id,
      cultivatorId: cultivator.id,
      status: 'active',
    });
    context.set('cultivator', cultivator);
    context.set('executor', executor);
    await next();
  };
}

export function requireActiveCultivatorRef(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const user = context.get('user') ?? (await resolveUser(context));

    if (!user) {
      context.res = errorBody('未授权访问', 401);
      return;
    }

    const existingRef = context.get('activeCultivatorRef');
    const ref = existingRef ?? (await resolveActiveCultivatorRef(user));

    if (!ref) {
      context.res = errorBody('当前没有活跃角色', 404);
      return;
    }

    context.set('user', user);
    context.set('activeCultivatorRef', ref);
    context.set('executor', getExecutor());
    await next();
  };
}

export function validateJson<TSchema extends ZodType>(schema: TSchema) {
  return (async (context: Context<AppEnv>, next) => {
    const rawBody = await context.req
      .json()
      .catch(() => undefined);
    const parsed = schema.parse(rawBody);
    context.set('validatedJson', parsed);
    await next();
  }) satisfies MiddlewareHandler<AppEnv>;
}

export function validateQuery<TSchema extends ZodType>(schema: TSchema) {
  return (async (context: Context<AppEnv>, next) => {
    const query = context.req.query();
    const parsed = schema.parse(query);
    context.set('validatedQuery', parsed);
    await next();
  }) satisfies MiddlewareHandler<AppEnv>;
}

export function getValidatedJson<T>(context: Context<AppEnv>): T {
  return context.get('validatedJson') as T;
}

export function getValidatedQuery<T>(context: Context<AppEnv>): T {
  return context.get('validatedQuery') as T;
}
