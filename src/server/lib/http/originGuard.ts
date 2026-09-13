import type { AppEnv } from '@server/lib/hono/types';
import type { MiddlewareHandler } from 'hono';
import { isAllowedPublicWebOrigin, normalizeOrigin } from './origins';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getApiSelfOrigin() {
  return normalizeOrigin(process.env.BETTER_AUTH_URL);
}

function isAllowedWriteOrigin(origin: string | undefined | null) {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  const selfOrigin = getApiSelfOrigin();
  return normalized === selfOrigin || isAllowedPublicWebOrigin(normalized);
}

export function unsafeRequestOriginGuard(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    if (!UNSAFE_METHODS.has(context.req.method.toUpperCase())) {
      await next();
      return;
    }

    const origin = context.req.header('origin');
    // Cookie-authenticated writes and browser requests must identify their source.
    // Non-browser, cookie-free callers (e.g. webhooks) retain their own auth boundary.
    const requiresOrigin =
      context.req.header('cookie') !== undefined ||
      context.req.header('sec-fetch-site') !== undefined;
    if ((!origin && requiresOrigin) || !isAllowedWriteOrigin(origin)) {
      return context.json({ success: false, error: 'Forbidden origin' }, 403);
    }

    await next();
  };
}

export const originGuardInternals = {
  isAllowedWriteOrigin,
};
