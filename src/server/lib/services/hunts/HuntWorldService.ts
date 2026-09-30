import { redis } from '@server/lib/redis';
import { withRedisLock } from '@server/lib/redis/lock';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import { HUNT_BOSSES, huntEventsAt } from '@shared/hunts/config';
import { cleanupHuntTeams } from './HuntTeamService';
export async function refreshHuntWorld() {
  await withRedisLock(
    {
      key: 'lock:hunt:v1:refresh',
      context: 'hunt-refresh',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      for (const event of huntEventsAt(Date.now())) {
        const key = `hunt:v1:announced:${event.id}`;
        if (await redis.exists(key)) continue;
        const text = `传闻「${HUNT_BOSSES[event.bossId].name}」现身${event.locationName}，已有${event.realm}期修为。欲往讨伐的道友，切记结伴同行。`;
        lease.assertHeld();
        await createMessage({
          id: event.id,
          createdAt: new Date(event.startsAt).toISOString(),
          senderUserId: 'system',
          senderCultivatorId: null,
          senderName: '修仙界传闻',
          senderRealm: '',
          senderRealmStage: '',
          channel: 'system',
          messageType: 'hunt_rumor',
          textContent: text,
          payload: { text, eventId: event.id, nodeId: event.nodeId },
        });
        await redis.set(key, '1', 'EX', 172800);
      }
      await cleanupHuntTeams();
    },
  );
}
let timer: ReturnType<typeof setTimeout> | undefined;
let task: Promise<void> | undefined;
let stopped = true;
export function startHuntWorld() {
  if (!stopped) return;
  stopped = false;
  const run = () => {
    task = refreshHuntWorld()
      .catch((error) => console.warn('[hunt] refresh failed', error))
      .finally(() => {
        if (!stopped) {
          timer = setTimeout(run, 60000);
          timer.unref();
        }
      });
  };
  run();
}
export async function stopHuntWorld() {
  stopped = true;
  clearTimeout(timer);
  await task;
}
