import { websocket } from 'hono/bun';
import app from './server/app';
import { registerInternalCronJobs } from './server/lib/jobs/internalCronScheduler';
import {
  registerMessageInfrastructure,
  shutdownMessageInfrastructure,
} from './server/lib/mq/domainEventRegistry';

await registerMessageInfrastructure();
registerInternalCronJobs({ enabled: import.meta.env.PROD });

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info('[runtime] graceful shutdown started', { signal });
  await shutdownMessageInfrastructure();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

export default {
  hostname: process.env.HOST,
  port: Number(process.env.PORT ?? 3000),
  fetch(request: Request, server: unknown) {
    return app.fetch(request, { server });
  },
  websocket,
};
