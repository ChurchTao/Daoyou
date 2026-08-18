import { handleAuthRequest } from '@server/lib/auth/hono';
import { apiIpRateLimit } from '@server/lib/hono/apiIpRateLimit';
import { jsonError, redisLockErrorResponse } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { runWithContext } from '@server/lib/http/context';
import { apiCorsOptions } from '@server/lib/http/cors';
import { unsafeRequestOriginGuard } from '@server/lib/http/originGuard';
import apiRouter from '@server/routes/api';
import internalRouter from '@server/routes/internal';
import { LlmByokConfigSchema } from '@shared/config/llm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono<AppEnv>();

app.use('/api/*', logger());
app.use('/internal/*', logger());

app.use('*', async (context, next) => runWithContext(context, next));

app.use('/api/*', cors(apiCorsOptions));
app.use('/api/*', unsafeRequestOriginGuard());

app.use('*', async (context, next) => {
  const provider = context.req.header('x-llm-provider');
  const apiKey = context.req.header('x-llm-api-key');
  const model = context.req.header('x-llm-model');

  if (provider !== undefined || apiKey !== undefined || model !== undefined) {
    const parsed = LlmByokConfigSchema.safeParse({ provider, apiKey, model });
    if (!parsed.success) {
      return context.json(
        {
          success: false,
          error: 'LLM 配置不完整或格式无效',
        },
        400,
      );
    }
    context.set('llmConfig', parsed.data);
  }

  await next();
});

app.use('/api/*', apiIpRateLimit());
app.all('/api/auth/*', handleAuthRequest);
app.use('/api/*', jsonError());
app.use('/internal/*', jsonError());

app.route('/api', apiRouter);
app.route('/internal', internalRouter);

app.notFound((c) => c.redirect('https://client.daoyou.org'));

app.onError((error, c) => {
  const lockErrorResponse = redisLockErrorResponse(error);
  if (lockErrorResponse) {
    return lockErrorResponse;
  }
  console.error('Unhandled Hono error:', error);
  return c.json(
    {
      success: false,
      error: '服务器内部错误',
    },
    500,
  );
});

export default app;
