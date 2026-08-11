import type { BattleMatchSessionV1 } from '@shared/contracts/battle-matches';
import type { BattleBoardgamePlayerViewV1 } from '@shared/online-battle/BattleBoardgameClientGame';
import { useEffect, useMemo, useState } from 'react';
import {
  commitBattleIntents,
  createBattleMatchClient,
} from './battleMatchClient';

type BattleClient = ReturnType<typeof createBattleMatchClient>;
export type BattleMatchConnectionStatus =
  'connecting' | 'connected' | 'disconnected';

export function useBattleMatchClient(matchId: string | null) {
  const [session, setSession] = useState<BattleMatchSessionV1 | null>(null);
  const [view, setView] = useState<BattleBoardgamePlayerViewV1 | null>(null);
  const [viewReceivedAt, setViewReceivedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<BattleMatchConnectionStatus>('connecting');
  const activeSession = session && session.matchID === matchId ? session : null;

  useEffect(() => {
    let cancelled = false;
    if (!matchId) return;
    void fetch(`/api/battle-matches/${encodeURIComponent(matchId)}/session`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          session?: BattleMatchSessionV1;
          error?: string;
        };
        if (!response.ok || !body.session) {
          throw new Error(body.error ?? '无法加入战斗对局');
        }
        if (!cancelled) {
          setError(null);
          setSession(body.session);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : '无法加入战斗对局',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const client = useMemo(
    () => (activeSession ? createBattleMatchClient(activeSession) : null),
    [activeSession],
  );

  useEffect(() => {
    if (!client) return;
    const onState: Parameters<BattleClient['subscribe']>[0] = (state) => {
      const nextView = state?.G as BattleBoardgamePlayerViewV1 | undefined;
      setView(nextView ?? null);
      if (state?.isConnected === false) {
        setConnectionStatus('disconnected');
      } else if (nextView) {
        setConnectionStatus('connected');
        setViewReceivedAt(Date.now());
      }
    };
    const unsubscribe = client.subscribe(onState);
    client.start();
    return () => {
      unsubscribe();
      client.stop();
    };
  }, [client]);

  const actions = useMemo(
    () =>
      client
        ? {
            commitIntents: (
              intents: Parameters<typeof commitBattleIntents>[1],
              round: number,
              checkpointRevision: number,
              requestId?: string,
            ) =>
              commitBattleIntents(
                client,
                intents,
                round,
                checkpointRevision,
                requestId,
              ),
          }
        : null,
    [client],
  );

  return {
    client,
    session: activeSession,
    view: client ? view : null,
    viewReceivedAt,
    connectionStatus,
    error,
    actions,
  };
}
