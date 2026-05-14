import { handleAuthRequest } from '@server/lib/auth/hono';
import { Hono } from 'hono';
import { runWithContext } from '@server/lib/http/context';
import { jsonError } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import apiRouter from '@server/routes/api';
import internalRouter from '@server/routes/internal';

const app = new Hono<AppEnv>();

app.use('*', async (context, next) => runWithContext(context, next));
app.all('/api/auth/*', handleAuthRequest);
app.use('/api/*', jsonError());
app.use('/internal/*', jsonError());

app.route('/api', apiRouter);
app.route('/internal', internalRouter);

app.notFound((c) =>
  c.json(
    {
      success: false,
      error: 'Not Found',
    },
    404,
  ),
);

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
