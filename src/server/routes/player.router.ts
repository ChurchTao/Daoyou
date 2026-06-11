import { getExecutor } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import {
  getValidatedJson,
  requireActiveCultivator,
  requireActiveCultivatorRef,
  requireUser,
  validateJson,
} from '@server/lib/hono/middleware';
import { listStateEventsAfter } from '@server/lib/repositories/playerStateRepository';
import {
  buildPlayerStateSnapshot,
  parsePlayerStateDomains,
} from '@server/lib/services/PlayerStateSnapshotService';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import { subscribePlayerStateEvents } from '@server/lib/services/playerStateBroadcaster';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getCultivatorsByUserId,
  hasDeadCultivator,
  updateCultivatorGameSettings,
} from '@server/lib/services/cultivatorService';
import { getCultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { PlayerActiveResponse } from '@shared/contracts/player';
import type {
  PlayerStateEventsResponse,
  PlayerStateEvent,
  PlayerStateSnapshotResponse,
  PlayerStateStreamPayload,
} from '@shared/contracts/player';
import type {
  PlayerSettingsResponse,
  UpdatePlayerSettingsRequest,
} from '@shared/contracts/playerSettings';
import {
  CultivatorGameSettingsSchema,
  normalizeCultivatorGameSettings,
} from '@shared/types/gameSettings';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const PLAYER_STATE_EVENT_PAGE_LIMIT = 200;

const UpdatePlayerSettingsSchema = z.object({
  gameSettings: CultivatorGameSettingsSchema,
});

router.get('/active', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const cultivators = await getCultivatorsByUserId(user.id);
  const hasDead = await hasDeadCultivator(user.id);
  const cultivatorViews = cultivators.map((cultivator) => ({
    cultivator,
    display: getCultivatorDisplaySnapshot(cultivator),
  }));
  const activeCultivator = cultivatorViews[0] ?? null;
  const activeCultivatorId = activeCultivator?.cultivator.id;

  let unreadMailCount = 0;
  if (activeCultivatorId) {
    const result = await getExecutor()
      .select({ count: sql<number>`count(*)` })
      .from(mails)
      .where(
        and(
          eq(mails.cultivatorId, activeCultivatorId),
          eq(mails.isRead, false),
        ),
      );

    unreadMailCount = Number(result[0]?.count ?? 0);
  }

  const payload: PlayerActiveResponse = {
    success: true,
    data: {
      activeCultivator,
      cultivators: cultivatorViews,
      unreadMailCount,
    },
    meta: {
      hasActive: cultivatorViews.length > 0,
      hasDead,
    },
  };

  return c.json(payload);
});

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

router.get('/state/stream', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  const after = Number.parseInt(
    c.req.query('after') || c.req.header('Last-Event-ID') || '0',
    10,
  );
  const safeAfter = Number.isFinite(after) && after > 0 ? after : 0;
  const encoder = new TextEncoder();

  let cleanupStream: (() => void) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      };
      cleanupStream = cleanup;
      const safeSend = (payload: string) => {
        if (closed) {
          return false;
        }
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };
      const sendPayload = (
        events: Awaited<ReturnType<typeof listStateEventsAfter>>,
        payload: PlayerStateStreamPayload,
      ) => {
        if (events.length === 0) {
          return;
        }

        const lastEventId = events[events.length - 1]?.globalVersion;
        const frame =
          [
            'event: player-state',
            lastEventId ? `id: ${lastEventId}` : undefined,
            `data: ${JSON.stringify(payload)}`,
          ]
            .filter((line): line is string => Boolean(line))
            .join('\n') + '\n\n';
        safeSend(frame);
      };
      const sendEvents = (events: Awaited<ReturnType<typeof listStateEventsAfter>>) => {
        sendPayload(events, { events });
      };

      const missedEvents = await listStateEventsAfter(
        ref.cultivatorId,
        safeAfter,
      );
      sendPayload(
        missedEvents,
        shouldRequirePlayerStateSnapshot(missedEvents, safeAfter)
          ? { requiresSnapshot: true }
          : { events: missedEvents },
      );

      unsubscribe = subscribePlayerStateEvents(
        ref.cultivatorId,
        sendEvents,
      );
      heartbeat = setInterval(() => {
        safeSend(': heartbeat\n\n');
      }, 25_000);
      c.req.raw.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed by client
        }
      });
    },
    cancel() {
      cleanupStream?.();
      cleanupStream = null;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

router.get('/settings', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  const payload: PlayerSettingsResponse = {
    success: true,
    data: normalizeCultivatorGameSettings(cultivator?.gameSettings),
  };

  return c.json(payload);
});

router.put(
  '/settings',
  requireActiveCultivator(),
  validateJson(UpdatePlayerSettingsSchema),
  async (c) => {
    const user = c.get('user');
    const cultivator = c.get('cultivator');
    if (!user || !cultivator) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }

    const body = getValidatedJson<UpdatePlayerSettingsRequest>(c);
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'player_settings_update',
      run: async (tx) => {
        const updated = await updateCultivatorGameSettings(
          cultivator.id,
          body.gameSettings,
          tx,
        );
        return {
          result: updated,
          changes: [
            {
              domain: 'profile',
              eventType: 'profile.settings.changed',
              invalidates: ['profile'],
            },
          ],
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
  },
);

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
