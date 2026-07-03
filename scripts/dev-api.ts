import { websocket } from 'hono/bun';
import app from '../src/index';

const port = Number(process.env.API_PORT ?? 3000);

Bun.serve({
  port,
  fetch: app.fetch.bind(app),
  websocket,
});

console.info(`[dev-api] listening on http://localhost:${port}`);
