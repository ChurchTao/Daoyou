import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import { listStateEventsAfter } from '@server/lib/repositories/playerStateRepository';
import {
  buildPlayerStateSnapshot,
  parsePlayerStateDomains,
} from '@server/lib/services/PlayerStateSnapshotService';
import type { AppEnv } from '@server/lib/hono/types';
import type {
  PlayerStateEventsResponse,
  PlayerStateEvent,
  PlayerStateSnapshotResponse,
} from '@shared/contracts/player';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();
const PLAYER_STATE_EVENT_PAGE_LIMIT = 200;

router.get('/state', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const ref = c.get('activeCultivatorRef');
  if (!user || !ref) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const domains = parsePlayerStateDomains(c.req.query('domains'));
  const data = await buildPlayerStateSnapshot({
    userId: user.id,
    cultivatorId: ref.cultivatorId,
    domains,
  });
  const payload: PlayerStateSnapshotResponse = {
    success: true,
    data,
  };

  return c.json(payload);
});

// WebSocket gap-recovery endpoint. This is not an SSE stream; keep it until the
// realtime client no longer needs HTTP backfill after reconnect/version gaps.
router.get('/state/events', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  const after = Number.parseInt(c.req.query('after') || '0', 10);
  const safeAfter = Number.isFinite(after) && after > 0 ? after : 0;
  const events = await listStateEventsAfter(ref.cultivatorId, safeAfter);
  const payload: PlayerStateEventsResponse = {
    success: true,
    data: {
      after: safeAfter,
      events,
      requiresSnapshot: shouldRequirePlayerStateSnapshot(events, safeAfter),
    },
  };

  return c.json(payload);
});

export default router;

function shouldRequirePlayerStateSnapshot(
  events: PlayerStateEvent[],
  after: number,
): boolean {
  if (events.length >= PLAYER_STATE_EVENT_PAGE_LIMIT) {
    return true;
  }
  if (events.length === 0) {
    return false;
  }

  let expected = after + 1;
  const versions = Array.from(
    new Set(events.map((event) => event.globalVersion)),
  ).sort((left, right) => left - right);
  for (const version of versions) {
    if (version !== expected) {
      return true;
    }
    expected += 1;
  }

  return false;
}
