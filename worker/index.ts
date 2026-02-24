// @ts-expect-error `.open-next/worker.js` is generated at build time
import { default as handler } from '../.open-next/worker.js';

const INTERNAL_BASE_URL = 'https://internal.daoyou';
const CRON_ROUTES: Record<string, string[]> = {
  // 每小时处理过期拍卖
  '0 * * * *': ['/api/cron/auction-expire'],
  // 每日 00:00（北京时间，UTC+8）结算天骄榜奖励 Cloudflare Cron 使用 UTC，对应表达式为 16:00 UTC
  '0 16 * * *': ['/api/cron/rank-rewards'],
};

async function invokeInternalRoute(path: string, env: CloudflareEnv) {
  const selfReference = env.WORKER_SELF_REFERENCE;
  if (!selfReference) {
    throw new Error('Missing WORKER_SELF_REFERENCE binding');
  }

  const url = new URL(path, INTERNAL_BASE_URL).toString();
  const headers: HeadersInit = {};

  if (env.CRON_SECRET) {
    headers.Authorization = `Bearer ${env.CRON_SECRET}`;
  }

  const response = await selfReference.fetch(
    new Request(url, { method: 'GET', headers }),
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Cron route failed: ${path}, status=${response.status}, body=${body}`,
    );
  }
}

const worker = {
  fetch: handler.fetch,

  async scheduled(controller: ScheduledController, env: CloudflareEnv) {
    const routes = CRON_ROUTES[controller.cron] ?? [];
    if (routes.length === 0) {
      console.warn(`No route mapped for cron: ${controller.cron}`);
      return;
    }

    await Promise.all(routes.map((path) => invokeInternalRoute(path, env)));
  },
} satisfies ExportedHandler<CloudflareEnv>;

export default worker;

// @ts-expect-error `.open-next/worker.js` is generated at build time
export { DOQueueHandler, DOShardedTagCache } from '../.open-next/worker.js';
// @ts-expect-error `.open-next/worker.js` is generated at build time
export { BucketCachePurge } from '../.open-next/worker.js';
