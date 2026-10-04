import { apiCorsOptions } from '@server/lib/http/cors.js';
import { getRequestIp } from '@server/lib/http/requestIp.js';
import { checkApiIpRateLimit } from '@server/lib/redis/apiIpRateLimiter.js';
import { LlmByokConfigSchema } from '@daoyou/contracts/llm/config';

export type HandshakeError = {
  status: number;
  message: string;
  headers?: Headers;
  body?: { error: string };
};

/** Upgrade requests bypass Express middleware and need the same API admission checks. */
export async function verifyWebSocketRequest(
  headers: Headers,
): Promise<HandshakeError | { headers: Headers }> {
  const responseHeaders = new Headers({
    Vary: 'Origin',
    'Access-Control-Allow-Credentials': 'true',
  });
  const origin = apiCorsOptions.origin(headers.get('origin') ?? '');
  if (origin) responseHeaders.set('Access-Control-Allow-Origin', origin);
  const provider = headers.get('x-llm-provider') ?? undefined;
  const apiKey = headers.get('x-llm-api-key') ?? undefined;
  const model = headers.get('x-llm-model') ?? undefined;
  if (
    (provider !== undefined || apiKey !== undefined || model !== undefined) &&
    !LlmByokConfigSchema.safeParse({ provider, apiKey, model }).success
  )
    return {
      status: 400,
      message: 'LLM 配置不完整或格式无效',
      headers: responseHeaders,
    };
  const ip = getRequestIp(headers);
  if (ip) {
    try {
      const limit = await checkApiIpRateLimit(ip);
      responseHeaders.set('X-RateLimit-Limit', String(limit.limit));
      responseHeaders.set('X-RateLimit-Remaining', String(limit.remaining));
      responseHeaders.set(
        'X-RateLimit-Reset',
        String(Math.ceil(limit.resetAt.getTime() / 1000)),
      );
      if (!limit.allowed) {
        responseHeaders.set('Retry-After', String(limit.retryAfterSeconds));
        return {
          status: 429,
          message: '请求过于频繁，请稍后再试',
          headers: responseHeaders,
        };
      }
    } catch (error) {
      console.warn(
        '[api-rate-limit] redis check failed; allowing request',
        error,
      );
    }
  }
  return { headers: responseHeaders };
}
