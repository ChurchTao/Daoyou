import { useCallback, useEffect, useRef, useState } from 'react';

export type ConversationSessionPhase =
  'idle' | 'loading' | 'ready' | 'submitting' | 'error';

export interface ConversationSessionActionContext<TSnapshot, TIntent> {
  snapshot: TSnapshot | undefined;
  intent: TIntent;
  signal: AbortSignal;
}

export interface UseConversationSessionOptions<TSnapshot, TIntent, TResult> {
  sessionKey: string;
  snapshot: TSnapshot | undefined;
  load?(signal: AbortSignal): Promise<unknown>;
  perform(
    context: ConversationSessionActionContext<TSnapshot, TIntent>,
  ): Promise<TResult>;
  mapError?(reason: unknown): string;
  onReset?(): void;
  onDispose?(): void;
}

export interface ConversationSessionState<TSnapshot, TIntent, TResult> {
  phase: ConversationSessionPhase;
  snapshot: TSnapshot | undefined;
  result: TResult | undefined;
  error: string | undefined;
  reload(): Promise<void>;
  dispatch(intent: TIntent): Promise<TResult | undefined>;
  clearResult(): void;
}

const defaultErrorMessage = (reason: unknown) =>
  reason instanceof Error ? reason.message : '交谈暂时中断，请稍后再试。';

/**
 * 只协调会话生命周期。业务快照仍由调用方的查询资源持有，
 * 意图执行、刷新范围和结果解释均由下游适配器决定。
 */
export function useConversationSession<TSnapshot, TIntent, TResult>({
  sessionKey,
  snapshot,
  load,
  perform,
  mapError = defaultErrorMessage,
  onReset,
  onDispose,
}: UseConversationSessionOptions<
  TSnapshot,
  TIntent,
  TResult
>): ConversationSessionState<TSnapshot, TIntent, TResult> {
  const [phase, setPhase] = useState<ConversationSessionPhase>('idle');
  const [result, setResult] = useState<TResult>();
  const [error, setError] = useState<string>();
  const generationRef = useRef(0);
  const operationRef = useRef<AbortController | undefined>(undefined);
  const loadRef = useRef(load);
  const performRef = useRef(perform);
  const mapErrorRef = useRef(mapError);
  const resetRef = useRef(onReset);
  const disposeRef = useRef(onDispose);

  useEffect(() => {
    loadRef.current = load;
    performRef.current = perform;
    mapErrorRef.current = mapError;
    resetRef.current = onReset;
    disposeRef.current = onDispose;
  }, [load, mapError, onDispose, onReset, perform]);

  const cancelCurrent = useCallback(() => {
    operationRef.current?.abort();
    operationRef.current = undefined;
  }, []);

  const reload = useCallback(async () => {
    cancelCurrent();
    const generation = ++generationRef.current;
    const controller = new AbortController();
    operationRef.current = controller;
    setError(undefined);
    setPhase('loading');
    try {
      await loadRef.current?.(controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted)
        return;
      setPhase('ready');
    } catch (reason) {
      if (generation !== generationRef.current || controller.signal.aborted)
        return;
      setError(mapErrorRef.current(reason));
      setPhase('error');
    } finally {
      if (operationRef.current === controller) operationRef.current = undefined;
    }
  }, [cancelCurrent]);

  const dispatch = useCallback(
    async (intent: TIntent): Promise<TResult | undefined> => {
      if (operationRef.current) return undefined;
      const generation = ++generationRef.current;
      const controller = new AbortController();
      operationRef.current = controller;
      setError(undefined);
      setResult(undefined);
      setPhase('submitting');
      try {
        const next = await performRef.current({
          snapshot,
          intent,
          signal: controller.signal,
        });
        if (generation !== generationRef.current || controller.signal.aborted)
          return undefined;
        setResult(next);
        setPhase('ready');
        return next;
      } catch (reason) {
        if (generation !== generationRef.current || controller.signal.aborted)
          return undefined;
        setError(mapErrorRef.current(reason));
        setPhase('error');
        return undefined;
      } finally {
        if (operationRef.current === controller)
          operationRef.current = undefined;
      }
    },
    [snapshot],
  );

  useEffect(() => {
    generationRef.current += 1;
    cancelCurrent();
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setResult(undefined);
      setError(undefined);
      setPhase('idle');
      resetRef.current?.();
      void reload();
    });
    return () => {
      active = false;
      generationRef.current += 1;
      cancelCurrent();
      disposeRef.current?.();
    };
  }, [cancelCurrent, reload, sessionKey]);

  return {
    phase,
    snapshot,
    result,
    error,
    reload,
    dispatch,
    clearResult: () => setResult(undefined),
  };
}
