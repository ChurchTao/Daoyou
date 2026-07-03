import type { AppEnv } from '@server/lib/hono/types';
import { isAllowedPublicWebOrigin, normalizeOrigin } from './origins';
import type { MiddlewareHandler } from 'hono';

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

    const secFetchSite = context.req.header('sec-fetch-site');
    if (secFetchSite === 'cross-site') {
      return context.json({ success: false, error: 'Forbidden origin' }, 403);
    }

    if (!isAllowedWriteOrigin(context.req.header('origin'))) {
      return context.json({ success: false, error: 'Forbidden origin' }, 403);
    }

    await next();
  };
}

export const originGuardInternals = {
  isAllowedWriteOrigin,
};
