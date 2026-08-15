import {
  BattleMatchSessionSchema,
  type BattleMatchSessionV2,
} from '@shared/contracts/battle-matches';
import { useEffect, useMemo, useState } from 'react';
import {
  createBattleMatchClient,
  type BattleMatchClientView,
} from './battleMatchClient';

export type BattleMatchConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected';

export function useBattleMatchClient(matchId: string | null) {
  const [session, setSession] = useState<BattleMatchSessionV2 | null>(null);
  const [view, setView] = useState<BattleMatchClientView | null>(null);
  const [viewReceivedAt, setViewReceivedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<BattleMatchConnectionStatus>('connecting');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const activeSession = session?.matchId === matchId ? session : null;

  useEffect(() => {
    let cancelled = false;
    if (!matchId) return;
    const delay = reconnectNonce === 0
      ? 0
      : Math.min(5_000, 250 * 2 ** Math.min(reconnectNonce, 5));
    const timer = window.setTimeout(() => {
      setConnectionStatus('connecting');
      void fetch(`/api/battle-matches/${encodeURIComponent(matchId)}/session`, {
        credentials: 'include',
        cache: 'no-store',
      })
        .then(async (response) => {
          const body = (await response.json()) as {
            session?: unknown;
            error?: string;
          };
          const parsedSession = BattleMatchSessionSchema.safeParse(body.session);
          if (!response.ok || !parsedSession.success) {
            throw new Error(body.error ?? '无法加入战斗对局');
          }
          if (!cancelled) {
            setError(null);
            setSession(parsedSession.data);
          }
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setError(reason instanceof Error ? reason.message : '无法加入战斗对局');
          setConnectionStatus('disconnected');
          setReconnectNonce((value) => value + 1);
        });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [matchId, reconnectNonce]);

  const client = useMemo(
    () => (activeSession ? createBattleMatchClient(activeSession) : null),
    [activeSession],
  );

  useEffect(() => {
    if (!client) return;
    let hadConnected = false;
    const unsubscribe = client.subscribe((state) => {
      const nextView = state.view;
      if (nextView) {
        setView(nextView);
        setViewReceivedAt(Date.now());
      }
      if (state.error) setError(state.error);
      if (state.isConnected) {
        hadConnected = true;
        setConnectionStatus('connected');
      } else if (hadConnected || state.error) {
        setConnectionStatus('disconnected');
        setSession(null);
        setReconnectNonce((value) => value + 1);
      }
    });
    client.start();
    return () => {
      unsubscribe();
      client.stop();
    };
  }, [client]);

  const actions = useMemo(
    () => client
      ? {
          commitIntents: client.commitIntents.bind(client),
          presentationReady: client.presentationReady.bind(client),
          syncLatest: client.syncLatest.bind(client),
        }
      : null,
    [client],
  );

  return {
    client,
    session: activeSession,
    view: client && view?.matchId === matchId ? view : null,
    viewReceivedAt,
    connectionStatus,
    error,
    actions,
  };
}
