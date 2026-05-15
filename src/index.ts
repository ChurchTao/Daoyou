import { readFile } from 'node:fs/promises';

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import apiApp from './server/app';
import { registerInternalCronJobs } from './server/lib/jobs/internalCronScheduler';

const indexHtmlUrl = new URL('../dist/index.html', import.meta.url);

let indexHtmlPromise: Promise<string> | undefined;

const getIndexHtml = () => {
  indexHtmlPromise ??= readFile(indexHtmlUrl, 'utf8');
  return indexHtmlPromise;
};

type RootAppOptions = {
  enableLogger?: boolean;
  isProd?: boolean;
  loadIndexHtml?: () => Promise<string>;
};

export function createRootApp(options: RootAppOptions = {}) {
  const {
    enableLogger = true,
    isProd = import.meta.env.PROD,
    loadIndexHtml = getIndexHtml,
  } = options;
  const app = new Hono();

  if (enableLogger) {
    app.use('/api/*', logger());
    app.use('/internal/*', logger());
  }

  registerInternalCronJobs({ enabled: isProd });

  app.route('/', apiApp);

  // 生产环境中的文件请求，如果请求的是 API 或内部接口，则返回 404
  // 否则返回 index.html，并由前端路由处理
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api') || c.req.path.startsWith('/internal/')) {
      return Response.json(
        {
          success: false,
          error: 'Not Found',
        },
        { status: 404 },
      );
    }

    const isPageRequest = c.req.method === 'GET' || c.req.method === 'HEAD';
    if (!isProd || !isPageRequest) {
      return new Response('Not Found', { status: 404 });
    }

    return c.html(await loadIndexHtml());
  });

  return app;
}

const app = createRootApp();

export default app;
