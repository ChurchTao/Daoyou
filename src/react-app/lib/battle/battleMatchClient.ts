import type { BattleMatchSessionV2 } from '@shared/contracts/battle-matches';
import {
  BattleClientMessageSchema,
  BattleServerMessageSchema,
  type BattleClientMessageV2,
  type BattleServerMessageV2,
  type OnlineBattlePlayerViewV2,
} from '@shared/contracts/onlineBattle';
import type { ClientBattleIntentV1 } from '@shared/engine/battle-v5/match/types';
import type { BattlePresentationWindowV1 } from '@shared/online-battle/BattlePresentation';
import { BattleServerClock } from './BattleServerClock';
import { BattleSyncStore } from './BattleSyncStore';

export type BattleMatchClientView = Omit<
  OnlineBattlePlayerViewV2,
  'roundResult'
> & {
  readonly presentationWindow?: BattlePresentationWindowV1;
};

export type BattleMatchClientState = {
  readonly view?: BattleMatchClientView;
  readonly isConnected?: boolean;
  readonly error?: string;
};

type Subscriber = (state: BattleMatchClientState) => void;

export class BattleMatchSocketClient {
  private socket: WebSocket | null = null;
  private readonly subscribers = new Set<Subscriber>();
  private state: BattleMatchClientState = { isConnected: false };
  private deliberateStop = false;
  private resyncPending = false;
  private pingTimer: number | undefined;
  private readonly clock = new BattleServerClock();
  private readonly syncStore = new BattleSyncStore();
  private readonly visibilityHandler = () => {
    if (document.visibilityState === 'visible') this.sendTimePing();
  };

  constructor(private readonly session: BattleMatchSessionV2) {}

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.state);
    return () => this.subscribers.delete(subscriber);
  }

  start(): void {
    if (this.socket) return;
    this.deliberateStop = false;
    const url = new URL(this.session.websocketUrl);
    url.searchParams.set('ticket', this.session.connectTicket);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.update({ ...this.state, isConnected: true, error: undefined });
      this.send({
        protocolVersion: 2,
        type: 'battle.resume',
        requestId: crypto.randomUUID(),
        matchId: this.session.matchId,
        lastEventSeq: this.syncStore.current()?.clientEventSeq ?? -1,
      });
      this.sendTimePing();
      this.pingTimer = window.setInterval(() => this.sendTimePing(), 10_000);
    });
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const parsed = BattleServerMessageSchema.safeParse(safeJson(event.data));
      if (!parsed.success) {
        this.update({
          ...this.state,
          isConnected: false,
          error: '战斗服务协议响应无效，请重新连接',
        });
        socket.close(1_002, 'invalid battle protocol response');
        return;
      }
      this.receive(parsed.data as BattleServerMessageV2);
    });
    document.addEventListener('visibilitychange', this.visibilityHandler);
    socket.addEventListener('close', () => {
      this.socket = null;
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = undefined;
      if (!this.deliberateStop) {
        this.update({ ...this.state, isConnected: false });
      }
    });
    socket.addEventListener('error', () => {
      this.update({
        ...this.state,
        isConnected: false,
        error: '战斗连接中断',
      });
    });
  }

  stop(): void {
    this.deliberateStop = true;
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    this.socket?.close(1_000, 'client stopped');
    this.socket = null;
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  commitIntents(
    intents: Readonly<Record<string, ClientBattleIntentV1>>,
    round: number,
    checkpointRevision: number,
    requestId: string = crypto.randomUUID(),
  ): string {
    this.send(
      BattleClientMessageSchema.parse({
        protocolVersion: 2,
        type: 'round.submit',
        requestId,
        matchId: this.session.matchId,
        round,
        checkpointRevision,
        intents,
      }),
    );
    return requestId;
  }

  presentationReady(
    round: number,
    resultId: string,
    requestId: string = crypto.randomUUID(),
  ): string {
    this.send({
      protocolVersion: 2,
      type: 'presentation.ready',
      requestId,
      matchId: this.session.matchId,
      round,
      resultId,
    });
    return requestId;
  }

  syncLatest(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const currentEventSeq = this.syncStore.current()?.clientEventSeq;
    if (currentEventSeq === undefined) return;
    this.requestResync(currentEventSeq);
  }

  private receive(message: BattleServerMessageV2 | null): void {
    if (!message) return;
    if (message.type === 'time.pong') {
      const receivedAt = Date.now();
      this.clock.addRoundTripSample(
        message.payload.clientSentAt,
        receivedAt,
        message.payload.serverNow,
      );
      const view = this.syncStore.refreshClock(this.clock.now(receivedAt));
      if (view) this.update({ ...this.state, view });
      const currentEventSeq = this.syncStore.current()?.clientEventSeq;
      if (
        currentEventSeq !== undefined &&
        message.payload.eventSeq !== currentEventSeq
      ) {
        this.requestResync(currentEventSeq);
      }
      return;
    }
    if (message.type === 'battle.resume_ok') {
      this.resyncPending = false;
      this.clock.addOneWayHint(message.payload.serverNow);
      const view = this.syncStore.refreshClock(this.clock.now());
      if (view) this.update({ ...this.state, view, isConnected: true });
      return;
    }
    if (message.type === 'battle.error') {
      this.update({ ...this.state, error: message.payload.message });
      return;
    }
    if (message.type === 'battle.snapshot') {
      this.resyncPending = false;
    }
    this.clock.addOneWayHint(message.payload.serverNow);
    const view = this.syncStore.apply(message, this.clock.now());
    if (view) {
      this.update({ ...this.state, view, isConnected: true });
    }
  }

  private send(message: BattleClientMessageV2): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Battle socket is not connected');
    }
    this.socket.send(JSON.stringify(message));
  }

  private sendTimePing(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.send({
      protocolVersion: 2,
      type: 'time.ping',
      requestId: crypto.randomUUID(),
      clientSentAt: Date.now(),
    });
  }

  private requestResync(lastEventSeq: number): void {
    if (this.resyncPending) return;
    this.resyncPending = true;
    this.send({
      protocolVersion: 2,
      type: 'battle.resume',
      requestId: crypto.randomUUID(),
      matchId: this.session.matchId,
      lastEventSeq,
    });
  }

  private update(state: BattleMatchClientState): void {
    this.state = state;
    for (const subscriber of this.subscribers) subscriber(state);
  }
}

export function createBattleMatchClient(
  session: BattleMatchSessionV2,
): BattleMatchSocketClient {
  return new BattleMatchSocketClient(session);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
