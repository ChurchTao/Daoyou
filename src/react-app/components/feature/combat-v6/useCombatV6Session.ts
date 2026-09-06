import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import { useCallback, useEffect, useRef, useState } from 'react';
import { combatV6Request, CombatV6RequestError, mutationBody } from './request';
import {
  emptySession,
  reduceSession,
  type CombatV6Session,
  type SessionAction,
} from './session';

/** All responses and timer ticks enter one controller. Refs are read only in callbacks. */
export function useCombatV6Session<T extends CombatV6Session>(
  base: string,
  enabled = true,
) {
  const [state, setState] = useState(emptySession<T>);
  const current = useRef(state);
  const generation = useRef(0);
  const mounted = useRef(false);
  const reading = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dispatch = useCallback((action: SessionAction<T>) => {
    if (!mounted.current) return;
    const next = reduceSession(current.current, action);
    current.current = next;
    setState(next);
  }, []);
  const acceptSession = useCallback(
    (session: T | null) => dispatch({ type: 'receive', session }),
    [dispatch],
  );
  const refresh = useCallback(
    (full = false) => {
      if (busy.current && !full) return Promise.resolve();
      reading.current?.abort();
      const controller = new AbortController();
      reading.current = controller;
      const epoch = generation.current;
      const known = current.current.session;
      const url = known
        ? `${base}/sessions/${known.sessionId}?afterEventSeq=${full ? -1 : known.latestEventSeq}`
        : `${base}/sessions/current`;
      return combatV6Request<T | null>(url, {
        signal: controller.signal,
      })
        .catch((cause: unknown) => {
          if (
            known &&
            !controller.signal.aborted &&
            cause instanceof CombatV6RequestError &&
            cause.status === 404
          ) {
            return combatV6Request<T | null>(`${base}/sessions/current`, {
              signal: controller.signal,
            });
          }
          throw cause;
        })
        .then((next) => {
          if (
            !mounted.current ||
            epoch !== generation.current ||
            controller.signal.aborted
          )
            return;
          dispatch({ type: 'receive', session: next, full: full || !known });
          setLoading(false);
          return next;
        })
        .catch((cause: unknown) => {
          if (
            !controller.signal.aborted &&
            mounted.current &&
            epoch === generation.current
          ) {
            setError(cause instanceof Error ? cause.message : '战斗加载失败');
            setLoading(false);
          }
        })
        .finally(() => {
          if (reading.current === controller) reading.current = null;
        });
    },
    [base, dispatch],
  );
  useEffect(() => {
    mounted.current = true;
    if (enabled) void refresh(true);
    return () => {
      mounted.current = false;
      reading.current?.abort();
    };
  }, [enabled, refresh]);
  useEffect(() => {
    if (state.recoveryNeeded) void refresh(true);
  }, [state.recoveryNeeded, refresh]);
  const firstFrame = state.queue[0];
  useEffect(() => {
    if (!firstFrame || state.recoveryNeeded) return;
    const timer = window.setTimeout(() => dispatch({ type: 'advance' }), 1000);
    return () => window.clearTimeout(timer);
  }, [firstFrame, state.recoveryNeeded, dispatch]);
  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      generation.current++;
      reading.current?.abort();
      setPending(true);
      setError('');
      try {
        await action();
      } catch (cause) {
        if (mounted.current) {
          setError(cause instanceof Error ? cause.message : '操作失败');
          await refresh(true);
        }
      } finally {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [refresh],
  );
  const resolve = useCallback(
    () =>
      run(async () => {
        const session = current.current.session;
        if (session)
          acceptSession(
            await combatV6Request<T>(
              `${base}/sessions/${session.sessionId}/resolve`,
              mutationBody({ expectedRevision: session.revision }),
            ),
          );
      }),
    [base, run, acceptSession],
  );
  const submit = useCallback(
    (command: CombatV6TrainingCommandV1) =>
      run(async () => {
        const session = current.current.session;
        const unitId = session?.commandOptions?.unitId;
        if (!session || !unitId) throw new Error('当前没有可下令的角色');
        const accepted = await combatV6Request<T>(
          `${base}/sessions/${session.sessionId}/commands/${encodeURIComponent(unitId)}`,
          mutationBody({ expectedRevision: session.revision, command }, 'PUT'),
        );
        acceptSession(accepted);
        acceptSession(
          await combatV6Request<T>(
            `${base}/sessions/${session.sessionId}/resolve`,
            mutationBody({ expectedRevision: accepted.revision }),
          ),
        );
      }),
    [base, run, acceptSession],
  );
  return {
    ...state,
    playing: !!state.queue.length || state.recoveryNeeded,
    pending,
    loading,
    error,
    setError,
    acceptSession,
    refresh,
    run,
    submit,
    resolve,
  };
}
