import { getRequestIp } from '@server/lib/http/requestIp';
import {
  checkApiIpRateLimit,
  type ApiIpRateLimitResult,
} from '@server/lib/redis/apiIpRateLimiter';
import type { AppEnv } from './types';
import type { Context, MiddlewareHandler } from 'hono';

function applyRateLimitHeaders(
  context: Context<AppEnv>,
  result: ApiIpRateLimitResult,
) {
  context.header('X-RateLimit-Limit', String(result.limit));
  context.header('X-RateLimit-Remaining', String(result.remaining));
  context.header(
    'X-RateLimit-Reset',
    String(Math.ceil(result.resetAt.getTime() / 1000)),
  );
}

function applyRateLimitHeadersToResponse(
  response: Response,
  result: ApiIpRateLimitResult,
) {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set(
    'X-RateLimit-Reset',
    String(Math.ceil(result.resetAt.getTime() / 1000)),
  );
}

export function apiIpRateLimit(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    if (context.req.path === '/api/health-check') {
      await next();
      return;
    }

    const ip = getRequestIp(context);
    if (!ip) {
      await next();
      return;
    }

    let result: ApiIpRateLimitResult;
    try {
      result = await checkApiIpRateLimit(ip);
    } catch (error) {
      console.warn('[api-rate-limit] redis check failed; allowing request', error);
      await next();
      return;
    }

    applyRateLimitHeaders(context, result);

    if (!result.allowed) {
      const response = Response.json(
        {
          success: false,
          error: '请求过于频繁，请稍后再试',
        },
        { status: 429 },
      );
      applyRateLimitHeadersToResponse(response, result);
      response.headers.set('Retry-After', String(result.retryAfterSeconds));
      context.res = response;
      return;
    }

    await next();
  };
}
