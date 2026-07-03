import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import { subscribePlayerStateEvents } from '@server/lib/services/playerStateBroadcaster';
import { subscribeWorldChatMessages } from '@server/lib/services/worldChatBroadcaster';
import type { RealtimeServerEvent } from '@shared/contracts/realtime';
import { upgradeWebSocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

function sendEnvelope(ws: WSContext, event: RealtimeServerEvent) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(JSON.stringify(event));
}

router.get('/', requireActiveCultivatorRef(), async (c) => {
  if (!isAllowedRealtimeOrigin(c.req.header('origin'))) {
    return c.json({ success: false, error: 'Forbidden origin' }, 403);
  }

  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  let cleanup: () => void = () => {};

  return upgradeWebSocket(c, {
    onOpen(_event, ws) {
      const unsubscribePlayerState = subscribePlayerStateEvents(
        ref.cultivatorId,
        (events) => {
          sendEnvelope(ws, {
            type: 'player-state.events',
            payload: { events },
          });
        },
      );
      const unsubscribeWorldChat = subscribeWorldChatMessages((message) => {
        sendEnvelope(ws, {
          type: 'world-chat.message',
          payload: message,
        });
      });
      let heartbeat: ReturnType<typeof setInterval> | null = setInterval(() => {
        sendEnvelope(ws, {
          type: 'ping',
          payload: { serverTime: new Date().toISOString() },
        });
      }, 25_000);
      cleanup = () => {
        unsubscribePlayerState();
        unsubscribeWorldChat();
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      };

      sendEnvelope(ws, {
        type: 'ready',
        payload: { cultivatorId: ref.cultivatorId },
      });
    },
    onMessage() {
      // First version is server-push only. Client pong frames are accepted but ignored.
    },
    onClose() {
      cleanup();
    },
    onError() {
      cleanup();
    },
  });
});

export default router;
