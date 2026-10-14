import { wandererAppearance, wandererRumor } from '@daoyou/game-rules/wanderer';
import { redis } from '@server/lib/redis/index.js';
import { withRedisLock } from '@server/lib/redis/lock.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';

export async function refreshWandererWorld() {
  await withRedisLock(
    {
      key: 'lock:wanderer:v1:refresh',
      context: 'wanderer-refresh',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const appearance = wandererAppearance(Date.now());
      const key = `wanderer:v1:announced:${appearance.id}`;
      if (await redis.exists(key)) return;
      const text = wandererRumor(appearance);
      lease.assertHeld();
      await createAndPublishWorldChatMessage({
        id: appearance.id,
        createdAt: new Date(appearance.startsAt).toISOString(),
        senderUserId: 'system',
        senderCultivatorId: null,
        senderName: '修仙界传闻',
        senderRealm: '',
        senderRealmStage: '',
        channel: 'system',
        messageType: 'text',
        textContent: text,
        payload: { text },
      });
      await redis.set(key, '1', 'EX', 172800);
    },
  );
}

let timer: ReturnType<typeof setTimeout> | undefined;
let task: Promise<void> | undefined;
let stopped = true;

export function startWandererWorld() {
  if (!stopped) return;
  stopped = false;
  const run = () => {
    task = refreshWandererWorld()
      .catch((error) => console.warn('[wanderer] refresh failed', error))
      .finally(() => {
        if (!stopped) {
          timer = setTimeout(run, 60000);
          timer.unref();
        }
      });
  };
  run();
}

export async function stopWandererWorld() {
  stopped = true;
  clearTimeout(timer);
  await task;
}
