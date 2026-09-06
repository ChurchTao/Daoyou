import {
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import {
  arenaSocketState,
  subscribeArenaSpectators,
  subscribeArenaV6,
} from '@server/lib/services/combat-v6/CombatV6ArenaBroadcast';
import {
  arenaReplayV6,
  ArenaV6Error,
  ownedArenaV6,
  submitArenaV6,
  watchedArenaV6,
} from '@server/lib/services/combat-v6/CombatV6ArenaService';
import { CombatV6ArenaStore } from '@server/lib/services/combat-v6/CombatV6ArenaStore';
import { arenaView } from '@shared/combat-v6/arena';
import {
  ArenaV6SubmitSchema,
  type ArenaV6Submit,
} from '@shared/contracts/combatV6Arena';
import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const store = new CombatV6ArenaStore();
const connectionCounts = new Map<string, number>();
router.use('*', requireActiveCultivatorRef());
router.onError((error, c) => {
  if (error instanceof ArenaV6Error)
    return c.json({ success: false, error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return c.json({ success: false, error: '请求参数无效' }, 400);
  console.error('[arena-v6] request failed', error);
  return c.json({ success: false, error: '战斗请求失败，请刷新重试' }, 500);
});
router.on('GET', ['/:battleId', '/:battleId/watch'], async (c) => {
  const id = z.uuid().parse(c.req.param('battleId'));
  c.header('Cache-Control', 'private, no-store');
  const { runtime, participant } = await (
    c.req.path.endsWith('/watch') ? watchedArenaV6 : ownedArenaV6
  )(id, c.get('activeCultivatorRef')!);
  const cursor = z.coerce
    .number()
    .int()
    .min(-1)
    .optional()
    .parse(c.req.query('afterEventSeq'));
  const last = runtime.lastResults[participant.unitId];
  const incremental =
    last?.revision === runtime.revision &&
    last.playback?.fromEventSeq === cursor;
  const view = incremental
    ? {
        ...last,
        serverNow: Date.now(),
        events: last.events.filter((e) => e.seq > cursor!),
      }
    : arenaView(runtime, participant.unitId, Date.now());
  const unchanged = cursor === view.latestEventSeq;
  return c.json({
    success: true,
    data: {
      session: unchanged ? { ...view, events: [], playback: undefined } : view,
      full: !incremental && !unchanged,
    },
  });
});
router.post(
  '/:battleId/commands',
  validateJson(ArenaV6SubmitSchema),
  async (c) => {
    const id = z.uuid().parse(c.req.param('battleId'));
    return c.json({
      success: true,
      data: await submitArenaV6(
        id,
        c.get('activeCultivatorRef')!,
        c.get('validatedJson') as ArenaV6Submit,
      ),
    });
  },
);
router.get('/:battleId/replay', async (c) =>
  c.json({
    success: true,
    data: await arenaReplayV6(
      z.uuid().parse(c.req.param('battleId')),
      c.get('activeCultivatorRef')!,
    ),
  }),
);
router.on(
  'GET',
  ['/:battleId/socket', '/:battleId/watch/socket'],
  async (c, next) => {
    if (!isAllowedRealtimeOrigin(c.req.header('origin')))
      return c.json({ error: 'Origin forbidden' }, 403);
    const id = z.uuid().parse(c.req.param('battleId'));
    await (
      c.req.path.endsWith('/watch/socket') ? watchedArenaV6 : ownedArenaV6
    )(id, c.get('activeCultivatorRef')!);
    return next();
  },
  upgradeWebSocket((c) => {
    const id = c.req.param('battleId')!;
    const actor = c.get('activeCultivatorRef')!;
    const spectator = c.req.path.endsWith('/watch/socket');
    const authorize = spectator ? watchedArenaV6 : ownedArenaV6;
    const connection = crypto.randomUUID();
    let viewerId: string | undefined;
    let dispose: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let admitted = false;
    let lastPong = Date.now();
    let lastRevision = -1;
    let chain = Promise.resolve();
    const cleanup = () => {
      closed = true;
      if (admitted) {
        admitted = false;
        const count = (connectionCounts.get(actor.userId) ?? 1) - 1;
        if (count) connectionCounts.set(actor.userId, count);
        else connectionCounts.delete(actor.userId);
      }
      clearInterval(heartbeat);
      dispose?.();
      if (viewerId && !spectator)
        void store
          .disconnect(`${id}:${viewerId}`, connection)
          .catch((error) =>
            console.warn('[arena-v6] disconnect failed', error),
          );
    };
    return {
      async onOpen(_event, ws) {
        try {
          if ((connectionCounts.get(actor.userId) ?? 0) >= 4) {
            ws.close(1008, 'too many connections');
            return;
          }
          admitted = true;
          connectionCounts.set(
            actor.userId,
            (connectionCounts.get(actor.userId) ?? 0) + 1,
          );
          const owned = await authorize(id, actor);
          viewerId = owned.participant.unitId;
          dispose = spectator
            ? await subscribeArenaSpectators(id, {
                ...actor,
                send: (message) => {
                  if (closed) return;
                  if (ws.raw.getBufferedAmount() > 512000) {
                    ws.close(4001, 'slow consumer');
                    cleanup();
                  } else ws.send(message);
                },
                close: () => {
                  ws.close(1008, 'spectator access ended');
                  cleanup();
                },
              })
            : await subscribeArenaV6(id, () => {
                chain = chain
                  .then(async () => {
                    if (closed) return;
                    const { runtime } = await authorize(id, actor);
                    if (runtime.revision <= lastRevision) return;
                    lastRevision = runtime.revision;
                    ws.send(
                      JSON.stringify(arenaSocketState(runtime, viewerId!)),
                    );
                  })
                  .catch(() => {
                    if (!closed) ws.close(1011, 'reconnect');
                  });
              });
          if (closed) {
            dispose();
            return;
          }
          if (!spectator) await store.touch(`${id}:${viewerId}`, connection);
          if (closed) {
            if (!spectator)
              await store.disconnect(`${id}:${viewerId}`, connection);
            return;
          }
          ws.send(JSON.stringify({ type: 'ready', serverNow: Date.now() }));
          heartbeat = setInterval(() => {
            if (Date.now() - lastPong > 50000) {
              ws.close(4000, 'heartbeat timeout');
              cleanup();
              return;
            }
            ws.send(JSON.stringify({ type: 'ping', serverNow: Date.now() }));
            // NATS Core is best effort: periodically repair a missed terminal push.
            chain = chain
              .then(async () => {
                if (closed) return;
                const { runtime } = await authorize(id, actor);
                ws.send(
                  JSON.stringify({
                    type: 'resync',
                    revision: runtime.revision,
                  }),
                );
              })
              .catch(() => {
                if (!closed) ws.close(1011, 'reconnect');
              });
          }, 25000);
        } catch {
          cleanup();
          ws.close(1011, 'reconnect');
        }
      },
      onMessage(event, ws) {
        if (typeof event.data !== 'string' || event.data.length > 128) {
          ws.close(1008, 'invalid message');
          return;
        }
        if (event.data === 'pong') {
          lastPong = Date.now();
          if (viewerId && !spectator)
            void store
              .touch(`${id}:${viewerId}`, connection)
              .catch(() => ws.close(1011, 'reconnect'));
        }
      },
      onClose: cleanup,
      onError: cleanup,
    };
  }),
);
export default router;
