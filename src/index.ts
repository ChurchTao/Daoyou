export { websocket } from 'hono/bun';

import app from './server/app';
import { registerInternalCronJobs } from './server/lib/jobs/internalCronScheduler';

registerInternalCronJobs({ enabled: import.meta.env.PROD });

export default app;
