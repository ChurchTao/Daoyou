import type {
  ArenaSessionView,
  ArenaSocketMessage,
  ArenaV6Submit,
} from '@shared/contracts/combatV6Arena';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { combatV6Request, CombatV6RequestError, mutationBody } from './request';
import { emptySession, reduceSession } from './session';

export function useArenaV6Session(battleId: string, spectator = false) {
  const [state, dispatch] = useReducer(
    reduceSession<ArenaSessionView>,
    undefined,
    emptySession<ArenaSessionView>,
  );
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [retry, setRetry] = useState<ArenaV6Submit>();
  const [generation, refresh] = useReducer((n) => n + 1, 0);
  const readRef = useRef<(full?: boolean) => void>(() => {});
  const latest = useRef<ArenaSessionView | null>(null);
  const busy = useRef(false);
  const lifecycle = useRef({ version: 0 });
  useEffect(() => {
    latest.current = state.session;
  }, [state.session]);
  const base = `/api/combat-v6/arena/${encodeURIComponent(battleId)}${spectator ? '/watch' : ''}`;

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let ready = false;
    let reading = false;
    let accessEnded = false;
    let serial = 0;
    let buffered: ArenaSessionView[] = [];
    const lifetime = lifecycle.current;
    ++lifetime.version;
    const read = async (full = true) => {
      const request = ++serial;
      controller?.abort();
      controller = new AbortController();
      reading = true;
      try {
        const cursor =
          !full && latest.current
            ? `?afterEventSeq=${latest.current.latestEventSeq}`
            : '';
        const data = await combatV6Request<{
          session: ArenaSessionView;
          full: boolean;
        }>(base + cursor, { signal: controller.signal });
        if (disposed || request !== serial) return;
        setClockOffset(data.session.serverNow - Date.now());
        dispatch({ type: 'receive', session: data.session, full: data.full });
        for (const session of buffered)
          if (session.revision > data.session.revision)
            dispatch({ type: 'receive', session });
        buffered = [];
        ready = true;
        setError(undefined);
      } catch (cause) {
        if (!disposed && request === serial) {
          if (
            cause instanceof CombatV6RequestError &&
            (cause.status === 403 || cause.status === 404)
          ) {
            accessEnded = true;
            clearTimeout(retryTimer);
          }
          setError(cause instanceof Error ? cause.message : '恢复失败');
          socket?.close();
        }
      } finally {
        if (request === serial) reading = false;
      }
    };
    readRef.current = (full) => {
      void read(full);
    };
    const connect = () => {
      if (disposed || accessEnded) return;
      ready = false;
      buffered = [];
      const url = new URL(`${base}/socket`, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        if (disposed) return;
        let message: ArenaSocketMessage;
        try {
          message = JSON.parse(event.data) as ArenaSocketMessage;
        } catch {
          socket?.close();
          return;
        }
        if (message.type === 'ping') {
          socket?.send('pong');
          return;
        }
        if (message.type === 'ready') {
          setClockOffset(message.serverNow - Date.now());
          setConnected(true);
          void read();
          return;
        }
        if (message.type === 'resync') {
          if (!reading && message.revision > (latest.current?.revision ?? -1))
            void read(false);
          return;
        }
        if (message.type !== 'state') return;
        if (!ready || reading) {
          buffered.push(message.session);
          if (buffered.length > 32) {
            buffered = [];
            void read();
          }
        } else dispatch({ type: 'receive', session: message.session });
      };
      socket.onclose = (event) => {
        if (disposed) return;
        setConnected(false);
        ready = false;
        if (latest.current?.stage === 'finished') return;
        if (event.code === 1008) {
          accessEnded = true;
          setError('观战或连接权限已结束，请返回擂台');
          return;
        }
        if (!reading && !latest.current) void read();
        if (!accessEnded) retryTimer = setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      disposed = true;
      lifetime.version++;
      clearTimeout(retryTimer);
      controller?.abort();
      socket?.close();
      readRef.current = () => {};
    };
  }, [base, generation]);

  useEffect(() => {
    if (state.recoveryNeeded) readRef.current(true);
  }, [state.recoveryNeeded]);
  useEffect(() => {
    if (!state.queue.length) return;
    const timer = setTimeout(() => dispatch({ type: 'advance' }), 1000);
    return () => clearTimeout(timer);
  }, [state.queue]);

  const send = useCallback(
    async (input: ArenaV6Submit) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError(undefined);
      const token = lifecycle.current.version;
      try {
        await combatV6Request(base + '/commands', mutationBody(input));
        if (token !== lifecycle.current.version) return;
        setRetry(undefined);
        // HTTP acknowledgement is authoritative even if the corresponding push was lost.
        readRef.current(false);
      } catch (cause) {
        if (token !== lifecycle.current.version) return;
        if (
          cause instanceof CombatV6RequestError &&
          cause.status &&
          cause.status < 500
        ) {
          setRetry(undefined);
          readRef.current(false);
        } else setRetry(input);
        setError(cause instanceof Error ? cause.message : '指令提交失败');
      } finally {
        busy.current = false;
        if (token === lifecycle.current.version) setPending(false);
      }
    },
    [base],
  );
  const submit = useCallback(
    async (
      commands: import('@shared/contracts/combatV6').CombatV6CommandGroup,
    ) => {
      const session = latest.current;
      if (spectator || !session || !connected || retry) return;
      await send({
        round: session.round,
        requestId: crypto.randomUUID(),
        commands,
      });
    },
    [connected, retry, send, spectator],
  );
  return {
    state,
    connected,
    clockOffset,
    pending,
    error,
    retry,
    retryCommand: () => {
      if (retry) void send(retry);
    },
    submit,
    refresh,
  };
}
