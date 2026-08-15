import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import {
  getBattleMatchParticipant,
  listBattleMatchInvitations,
} from '@server/lib/services/BattleMatchParticipantRepository';
import { BattleMatchmakerService } from '@server/lib/services/BattleMatchmakerService';
import { buildOnlineBattleMatchState } from '@server/lib/services/BattleOnlineMatchFactory';
import { observeOnlineBattleMetric } from '@server/lib/services/OnlineBattleMetrics';
import {
  MAX_BATTLE_CONNECTIONS_PER_PLAYER,
  MAX_SOCKET_MESSAGE_BYTES,
  OnlineBattleCommandRateWindow,
  onlineBattleMessageByteLength,
} from '@server/lib/services/OnlineBattleSocketPolicy';
import {
  consumeOnlineBattleTicket,
  issueOnlineBattleTicket,
  type OnlineBattleTicketIdentity,
} from '@server/lib/services/OnlineBattleTicketService';
import {
  subscribeOnlineBattleChanges,
  type OnlineBattleBroadcastEvent,
} from '@server/lib/services/onlineBattleBroadcaster';
import { getOnlineBattleCoordinator } from '@server/lib/services/onlineBattleRuntime';
import {
  BattleClientMessageSchema,
  type BattleServerMessageV2,
} from '@shared/contracts/onlineBattle';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { z } from 'zod';

const MatchIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);
const CreateOnlineMatchSchema = z
  .object({
    team: z.object({ cultivatorIds: z.array(z.string().uuid()).min(1).max(4) }),
    opponentTeam: z.object({
      cultivatorIds: z.array(z.string().uuid()).min(1).max(4),
    }),
  })
  .strict();

const router = new Hono<AppEnv>();
const matchmaker = new BattleMatchmakerService();
const battleCoordinator = getOnlineBattleCoordinator();
const pendingSocketIdentities = new WeakMap<
  Context<AppEnv>,
  OnlineBattleTicketIdentity
>();
const battleConnectionCounts = new Map<string, number>();

const consumeSocketTicket = (async (c, next) => {
  if (!isAllowedRealtimeOrigin(c.req.header('origin'))) {
    return c.json({ error: 'Forbidden origin' }, 403);
  }
  const identity = await consumeOnlineBattleTicket(c.req.query('ticket') ?? '');
  if (!identity || identity.matchId !== c.req.param('matchId')) {
    return c.json({ error: 'Invalid or expired battle ticket' }, 401);
  }
  pendingSocketIdentities.set(c, identity);
  await next();
  pendingSocketIdentities.delete(c);
}) satisfies MiddlewareHandler<AppEnv>;

router.get(
  '/:matchId/socket',
  consumeSocketTicket,
  upgradeWebSocket((rawContext) => {
    const c = rawContext as Context<AppEnv>;
    const identity = pendingSocketIdentities.get(c);
    if (!identity) throw new Error('Battle socket identity is missing');
    pendingSocketIdentities.delete(c);
    let closed = false;
    let resumed = false;
    let lastSentEventSeq = -1;
    let unsubscribe: (() => void) | undefined;
    let subscriptionReady = Promise.resolve();
    let sendQueue = Promise.resolve();
    const commandRateWindow = new OnlineBattleCommandRateWindow();
    const connectionKey = `${identity.matchId}:${identity.playerId}`;
    battleConnectionCounts.set(
      connectionKey,
      (battleConnectionCounts.get(connectionKey) ?? 0) + 1,
    );
    let connectionReleased = false;
    const releaseConnection = () => {
      if (connectionReleased) return;
      connectionReleased = true;
      const next = (battleConnectionCounts.get(connectionKey) ?? 1) - 1;
      if (next <= 0) battleConnectionCounts.delete(connectionKey);
      else battleConnectionCounts.set(connectionKey, next);
    };
    const send = (ws: WSContext, message: BattleServerMessageV2) => {
      if (closed) return;
      const encoded = JSON.stringify(message);
      const payloadBytes = onlineBattleMessageByteLength(encoded);
      if (message.type === 'battle.snapshot') {
        observeOnlineBattleMetric('snapshot_payload_bytes', payloadBytes);
      }
      if (payloadBytes > MAX_SOCKET_MESSAGE_BYTES) {
        ws.close(1_009, 'battle message too large');
        closed = true;
        return;
      }
      ws.send(encoded);
    };
    const enqueue = (task: () => Promise<void> | void) => {
      sendQueue = sendQueue.then(task).catch((error) => {
        console.warn('[online-battle] socket send failed', {
          matchId: identity.matchId,
          playerId: identity.playerId,
          error,
        });
      });
    };
    const sendLatestSnapshotNow = async (ws: WSContext) => {
      const view = await battleCoordinator.playerViewLatest(
        identity.matchId,
        identity.playerId,
      );
      sendSnapshotView(ws, view);
    };
    const sendEventSnapshotsThrough = async (
      ws: WSContext,
      eventSeq: number,
    ) => {
      for (let sequence = lastSentEventSeq + 1; sequence <= eventSeq; sequence += 1) {
        const view = await battleCoordinator.playerViewAtEvent(
          identity.matchId,
          identity.playerId,
          sequence,
        );
        if (!view) {
          observeOnlineBattleMetric('event_snapshot_miss_total');
          await sendLatestSnapshotNow(ws);
          return;
        }
        if (view.clientEventSeq !== sequence) {
          throw new Error('Battle event view sequence mismatch');
        }
        sendSnapshotView(ws, view);
      }
    };
    const sendSnapshotView = (
      ws: WSContext,
      view: Awaited<ReturnType<typeof battleCoordinator.playerViewLatest>>,
    ) => {
      if (view.clientEventSeq < lastSentEventSeq) return;
      lastSentEventSeq = view.clientEventSeq;
      send(ws, { type: 'battle.snapshot', payload: view });
    };
    const sendBattleEvent = (
      ws: WSContext,
      event: OnlineBattleBroadcastEvent,
    ) => {
      if (!resumed) return;
      enqueue(async () => {
        if (event.eventSeq <= lastSentEventSeq) return;
        if (event.eventSeq !== lastSentEventSeq + 1) {
          observeOnlineBattleMetric('client_event_gap_total');
        }
        await sendEventSnapshotsThrough(ws, event.eventSeq);
      });
    };
    return {
      onOpen(_event, ws) {
        if (
          (battleConnectionCounts.get(connectionKey) ?? 0) >
          MAX_BATTLE_CONNECTIONS_PER_PLAYER
        ) {
          ws.close(4_029, 'too many battle connections');
          return;
        }
        const subscription = subscribeOnlineBattleChanges(
          identity.matchId,
          (event) => {
            sendBattleEvent(ws, event);
          },
        );
        unsubscribe = subscription.unsubscribe;
        subscriptionReady = subscription.ready;
      },
      async onMessage(event, ws) {
        const raw = event.data;
        if (
          typeof raw !== 'string' ||
          onlineBattleMessageByteLength(raw) > MAX_SOCKET_MESSAGE_BYTES
        ) {
          ws.close(1_003, 'invalid battle message');
          return;
        }
        if (!commandRateWindow.accept()) {
          ws.close(4_029, 'battle command rate exceeded');
          return;
        }
        const decoded = safeJson(raw);
        if (
          typeof decoded === 'object' &&
          decoded !== null &&
          'protocolVersion' in decoded &&
          decoded.protocolVersion !== 2
        ) {
          send(ws, {
            type: 'battle.error',
            payload: {
              code: 'BATTLE_PROTOCOL_UNSUPPORTED',
              message: '当前客户端战斗协议已过期，请刷新页面',
              serverNow: Date.now(),
            },
          });
          ws.close(1_002, 'unsupported battle protocol');
          return;
        }
        const parsed = BattleClientMessageSchema.safeParse(decoded);
        if (!parsed.success) {
          send(ws, {
            type: 'battle.error',
            payload: {
              code: 'INVALID_MESSAGE',
              message: '无效的战斗指令',
              serverNow: Date.now(),
            },
          });
          return;
        }
        const message = parsed.data;
        if ('matchId' in message && message.matchId !== identity.matchId) {
          ws.close(1_008, 'battle match mismatch');
          return;
        }
        if (message.type === 'time.ping') {
          enqueue(async () => {
            const cursor = await battleCoordinator.syncCursor(
              identity.matchId,
              identity.playerId,
            );
            send(ws, {
              type: 'time.pong',
              payload: {
                requestId: message.requestId,
                clientSentAt: message.clientSentAt,
                serverNow: cursor.serverNow,
                revision: cursor.revision,
                eventSeq: cursor.eventSeq,
              },
            });
          });
          return;
        }
        if (message.type === 'battle.resume') {
          if (resumed) {
            observeOnlineBattleMetric('presentation_boundary_resync_total');
          }
          resumed = true;
          enqueue(async () => {
            await subscriptionReady;
            await battleCoordinator.resolveDeadline(identity.matchId);
            const current = await battleCoordinator.playerViewLatest(
              identity.matchId,
              identity.playerId,
            );
            observeOnlineBattleMetric(
              'reconnect_revision_gap',
              Math.max(0, current.clientEventSeq - message.lastEventSeq),
            );
            if (message.lastEventSeq === current.clientEventSeq) {
              lastSentEventSeq = current.clientEventSeq;
              send(ws, {
                type: 'battle.resume_ok',
                payload: {
                  protocolVersion: 2,
                  matchId: current.matchId,
                  revision: current.revision,
                  eventSeq: current.clientEventSeq,
                  serverNow: current.serverNow,
                },
              });
            } else {
              lastSentEventSeq = -1;
              sendSnapshotView(ws, current);
            }
          });
          return;
        }
        try {
          if (message.type === 'round.submit') {
            const receipt = await battleCoordinator.submitRound({
              ...message,
              playerId: identity.playerId,
            });
            send(ws, {
              type: 'command.ack',
              payload: {
                commandType: 'round.submit',
                requestId: receipt.requestId,
                status: receipt.status,
                reason: receipt.reason,
                revision: receipt.matchRevision,
                serverNow: receipt.receivedAt,
              },
            });
          } else {
            const receipt = await battleCoordinator.presentationReady({
              ...message,
              playerId: identity.playerId,
            });
            send(ws, {
              type: 'command.ack',
              payload: {
                commandType: 'presentation.ready',
                requestId: message.requestId,
                status: receipt.status,
                reason: receipt.reason,
                revision: receipt.matchRevision,
                serverNow: receipt.receivedAt,
              },
            });
          }
        } catch (error) {
          console.warn('[online-battle] command rejected', {
            matchId: identity.matchId,
            playerId: identity.playerId,
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          send(ws, {
            type: 'battle.error',
            payload: {
              requestId: message.requestId,
              code: 'COMMAND_REJECTED',
              message: '战斗指令执行失败，请同步后重试',
              serverNow: Date.now(),
            },
          });
        }
      },
      onClose() {
        closed = true;
        unsubscribe?.();
        releaseConnection();
      },
      onError() {
        closed = true;
        unsubscribe?.();
        releaseConnection();
      },
    };
  }),
);

router.get('/invitations', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  return c.json({ invitations: await listBattleMatchInvitations(user.id) });
});

router.post('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const body = CreateOnlineMatchSchema.parse(await c.req.json());
  const state = await buildOnlineBattleMatchState({
    matchId: `online-${crypto.randomUUID()}`,
    teams: [body.team, body.opponentTeam],
  });
  const ownControllers = state.controllers.filter(
    (controller) => controller.teamId === 'alpha',
  );
  if (!ownControllers.some((controller) => controller.playerId === user.id)) {
    return c.json({ error: '创建者必须控制己方队伍中的至少一个角色' }, 403);
  }
  const created = await matchmaker.createAndPrejoin({
    state,
    acceptedPlayerIds: [user.id],
  });
  return c.json({ matchID: created.matchID, session: null });
});

router.get('/:matchId/session', requireUser(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const participant = await getBattleMatchParticipant(matchId, user.id);
  if (!participant) return c.json({ error: '无权访问该对局' }, 403);
  try {
    // The Redis participant projection and cursor are committed atomically
    // with acceptedPlayerIds; authorization does not need a full snapshot.
    await battleCoordinator.syncCursor(matchId, user.id);
    const connectTicket = await issueOnlineBattleTicket({
      matchId,
      playerId: user.id,
    });
    const publicOrigin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
    const socketUrl = new URL(
      `/api/battle-matches/${encodeURIComponent(matchId)}/socket`,
      publicOrigin,
    );
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const session = {
      protocolVersion: 2 as const,
      matchId,
      playerId: user.id,
      connectTicket,
      websocketUrl: socketUrl.toString(),
    };
    return c.json({ session });
  } catch (error) {
    console.error('[battle-match-session] gateway failed', error);
    return c.json({ error: '战斗服务暂不可用' }, 503);
  }
});

router.post('/:matchId/accept', requireUser(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const participant = await getBattleMatchParticipant(matchId, user.id);
  if (!participant) return c.json({ error: '无权访问该对局' }, 403);
  await matchmaker.acceptPlayer(matchId, user.id);
  return c.json({ accepted: true, session: null });
});

export default router;

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
