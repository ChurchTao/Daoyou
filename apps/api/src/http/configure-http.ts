import type { NestExpressApplication } from '@nestjs/platform-express';
import { handleAuthRequest } from '@server/lib/auth/handler.js';
import { runWithContext } from '@server/lib/http/context.js';
import { apiCorsOptions } from '@server/lib/http/cors.js';
import { isAllowedWriteOrigin } from '@server/lib/http/originPolicy.js';
import { getRequestIp } from '@server/lib/http/requestIp.js';
import { checkApiIpRateLimit } from '@server/lib/redis/apiIpRateLimiter.js';
import { LlmByokConfigSchema } from '@daoyou/contracts/llm/config';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import type { NextFunction, Response } from 'express';
import { readRequestBody } from './json-body.js';
import type { GameRequest } from './request.js';
import { RequestWorkService } from './request-work.service.js';

export function configureHttp(app: NestExpressApplication): void {
  const work = app.get(RequestWorkService);
  app.disable('x-powered-by');
  // FirstQuery owns business query decoding, including malformed escapes.
  app.set('query parser', false);
  app.use((request: GameRequest, response: Response, next: NextFunction) => {
    request.gameContext = {};
    const startedAt = performance.now();
    response.once('finish', () => {
      if (
        !/^\/(api|internal)\//.test(request.path) ||
        request.path === '/api/health-check'
      )
        return;
      const duration = Math.round(performance.now() - startedAt);
      if (response.statusCode >= 400 || duration >= 1_000) {
        console.info(
          `[HTTP] ${request.method.padEnd(7)} ${request.path} → ${response.statusCode} (${duration}ms)`,
        );
      }
    });
    runWithContext(request.gameContext, next);
  });
  app.use(
    '/api',
    cors({
      origin: (origin, callback) =>
        callback(null, apiCorsOptions.origin(origin ?? '') || false),
      allowedHeaders: apiCorsOptions.allowHeaders,
      methods: apiCorsOptions.allowMethods,
      credentials: apiCorsOptions.credentials,
      maxAge: apiCorsOptions.maxAge,
      optionsSuccessStatus: 204,
    }),
  );
  app.use((request: GameRequest, response: Response, next: NextFunction) => {
    if (
      request.path.startsWith('/api/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ) {
      const origin = request.get('origin');
      const requiresOrigin =
        request.get('cookie') !== undefined ||
        request.get('sec-fetch-site') !== undefined;
      if ((!origin && requiresOrigin) || !isAllowedWriteOrigin(origin)) {
        response
          .status(403)
          .json({ success: false, error: 'Forbidden origin' });
        return;
      }
    }
    const provider = request.get('x-llm-provider');
    const apiKey = request.get('x-llm-api-key');
    const model = request.get('x-llm-model');
    if (provider !== undefined || apiKey !== undefined || model !== undefined) {
      const result = LlmByokConfigSchema.safeParse({ provider, apiKey, model });
      if (!result.success) {
        response
          .status(400)
          .json({ success: false, error: 'LLM 配置不完整或格式无效' });
        return;
      }
      request.gameContext.llmConfig = result.data;
    }
    next();
  });
  app.use(
    async (request: GameRequest, response: Response, next: NextFunction) => {
      if (
        !request.path.startsWith('/api/') ||
        request.path === '/api/health-check'
      )
        return next();
      const ip = getRequestIp(fromNodeHeaders(request.headers));
      if (!ip) return next();
      try {
        const result = await checkApiIpRateLimit(ip);
        response.setHeader('X-RateLimit-Limit', result.limit);
        response.setHeader('X-RateLimit-Remaining', result.remaining);
        response.setHeader(
          'X-RateLimit-Reset',
          Math.ceil(result.resetAt.getTime() / 1000),
        );
        if (!result.allowed) {
          response.setHeader('Retry-After', result.retryAfterSeconds);
          response
            .status(429)
            .json({ success: false, error: '请求过于频繁，请稍后再试' });
          return;
        }
      } catch (error) {
        console.warn(
          '[api-rate-limit] redis check failed; allowing request',
          error,
        );
      }
      next();
    },
  );
  const authHandler = toNodeHandler(handleAuthRequest);
  app.use((request: GameRequest, response: Response, next: NextFunction) => {
    if (request.path.startsWith('/api/auth/')) {
      const done = work.begin();
      return authHandler(request, response).catch(next).finally(done);
    }
    next();
  });
  // Better Auth owns its body. Business bodies are read by JsonBody after
  // guards; only the webhook has a route-specific transport limit.
  app.use(
    async (request: GameRequest, response: Response, next: NextFunction) => {
      if (
        request.method === 'POST' &&
        request.path === '/api/sponsorship/providers/afdian/webhook'
      ) {
        try {
          await readRequestBody(request, 256 * 1_024);
        } catch (error) {
          if (
            error instanceof Error &&
            'type' in error &&
            error.type === 'entity.too.large'
          ) {
            // The legacy app's onError maps the body-limit exception to this contract.
            response
              .status(500)
              .json({ success: false, error: '服务器内部错误' });
            return;
          }
          return next(error);
        }
      }
      next();
    },
  );
}
