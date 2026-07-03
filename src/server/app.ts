import { handleAuthRequest } from '@server/lib/auth/hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiCorsOptions } from '@server/lib/http/cors';
import { runWithContext } from '@server/lib/http/context';
import { unsafeRequestOriginGuard } from '@server/lib/http/originGuard';
import { apiIpRateLimit } from '@server/lib/hono/apiIpRateLimit';
import { jsonError } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { validateLlmBaseUrl } from '@server/lib/llm/allowedHosts';
import apiRouter from '@server/routes/api';
import internalRouter from '@server/routes/internal';

const app = new Hono<AppEnv>();

app.use('/api/*', logger());
app.use('/internal/*', logger());

app.use('*', async (context, next) => runWithContext(context, next));

app.use(
  '/api/*',
  cors(apiCorsOptions),
);
app.use('/api/*', unsafeRequestOriginGuard());

app.use('*', async (context, next) => {
  const provider = context.req.header('x-llm-provider');
  const apiKey = context.req.header('x-llm-api-key');
  const baseUrl = context.req.header('x-llm-base-url');
  const model = context.req.header('x-llm-model');
  const fastModel = context.req.header('x-llm-fast-model');

  if (provider && apiKey && model && fastModel) {
    // [安全守卫] 白名单校验：仅允许预注册的 LLM 服务商域名
    // 如果 baseUrl 非空且不在白名单内，丢弃整个 llmConfig 以防止
    // apiKey 被发送到攻击者控制的代理服务器
    let validatedBaseUrl: string | null = null;
    if (baseUrl) {
      validatedBaseUrl = validateLlmBaseUrl(baseUrl);
      if (!validatedBaseUrl) {
        console.warn(
          `[llm-guard] Rejected non-whitelisted LLM base URL: ${baseUrl}`,
        );
        // 不设置 llmConfig，回退到服务端默认 LLM
        await next();
        return;
      }
    }

    context.set('llmConfig', {
      provider,
      apiKey,
      baseUrl: validatedBaseUrl,
      model,
      fastModel,
    });
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
