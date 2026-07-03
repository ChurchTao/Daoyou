import { websocket } from 'hono/bun';
import app from './server/app';
import { registerInternalCronJobs } from './server/lib/jobs/internalCronScheduler';

registerInternalCronJobs({ enabled: import.meta.env.PROD });

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch(request: Request, server: unknown) {
    return app.fetch(request, { server });
  },
  websocket,
};
