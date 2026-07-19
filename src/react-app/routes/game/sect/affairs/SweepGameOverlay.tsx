import { InkButton, InkNotice } from '@app/components/ui';
import type { SectSweepSessionData } from '@shared/contracts/sect';
import {
  SWEEP_LEAF_COUNT,
  SWEEP_MAX_TICKS,
  SWEEP_TICK_RATE,
  type SweepGameState,
  type SweepInputSegment,
} from '@shared/engine/sect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { postJson } from '../components/SectScene';
import {
  attachSweepLittleJs,
  setSweepVirtualInput,
} from './SweepLittleJsRuntime';

interface SweepGameOverlayProps {
  close: () => void;
  onCompleted: () => Promise<unknown> | unknown;
  run: <T>(url: string, init: RequestInit, message: string) => Promise<T | undefined>;
}

export function SweepGameOverlay({ close, onCompleted, run }: SweepGameOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SectSweepSessionData>();
  const [state, setState] = useState<SweepGameState>();
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const completedRef = useRef(false);

  const start = useCallback(async () => {
    setStarting(true);
    completedRef.current = false;
    setState(undefined);
    const next = await run<SectSweepSessionData>(
      '/api/sects/current/tasks/gate_sweep/start',
      postJson(),
      '云阶清扫场已开启',
    );
    setSession(next);
    setStarting(false);
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void start();
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  const complete = useCallback(
    async (trace: SweepInputSegment[]) => {
      if (!session || completedRef.current) return;
      completedRef.current = true;
      setSubmitting(true);
      const result = await run(
        '/api/sects/current/tasks/gate_sweep/complete',
        postJson(
          {
            sessionId: session.sessionId,
            rulesVersion: session.rulesVersion,
            segments: trace,
          },
          session.sessionId,
        ),
        '山门清扫完成',
      );
      setSubmitting(false);
      if (result) {
        await onCompleted();
        close();
      } else completedRef.current = false;
    },
    [close, onCompleted, run, session],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !session) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void attachSweepLittleJs({
      root,
      seed: session.seed,
      onState: setState,
      onSuccess: (trace) => void complete(trace),
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else dispose = cleanup;
    });
    return () => {
      cancelled = true;
      dispose?.();
      setSweepVirtualInput(null, false);
    };
  }, [complete, session]);

  const remainingSeconds = Math.max(
    0,
    Math.ceil((SWEEP_MAX_TICKS - (state?.tick ?? 0)) / SWEEP_TICK_RATE),
  );
  const timedOut = state?.tick === SWEEP_MAX_TICKS && state.cleared < SWEEP_LEAF_COUNT;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-stone-950/95 p-2 text-stone-50 sm:p-5" role="dialog" aria-modal="true" aria-label="清扫山门小游戏">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 border-b border-white/15 pb-3">
        <div>
          <h2 className="font-serif text-xl">云阶扫叶</h2>
          <p className="text-xs text-stone-300">WASD / 方向键移动，空格挥帚；移动端使用下方控件。</p>
        </div>
        <div className="flex items-center gap-4 text-sm tabular-nums">
          <span>落叶 {state?.cleared ?? 0}/{SWEEP_LEAF_COUNT}</span>
          <span>连扫 {state?.maxCombo ?? 0}</span>
          <span>余时 {remainingSeconds}s</span>
          <InkButton variant="secondary" onClick={close} disabled={submitting}>退出</InkButton>
        </div>
      </header>
      <div className="relative mx-auto mt-3 min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-sm border border-white/15 bg-stone-900 shadow-2xl">
        <div ref={rootRef} className="absolute inset-0 flex items-center justify-center" />
        {starting ? <div className="absolute inset-0 grid place-items-center bg-stone-950/70">执事正在布置云阶……</div> : null}
        {submitting ? <div className="absolute inset-0 grid place-items-center bg-stone-950/70">正在验收清扫轨迹……</div> : null}
        {timedOut ? (
          <div className="absolute inset-0 grid place-items-center bg-stone-950/75 p-6 text-center">
            <InkNotice>
              晨钟已过，云阶仍有落叶。此次不会消耗今日委托。
              <InkButton onClick={() => void start()}>重新清扫</InkButton>
            </InkNotice>
          </div>
        ) : null}
      </div>
      <MobileControls />
    </div>
  );
}

function MobileControls() {
  const directions = [7, 0, 1, 6, null, 2, 5, 4, 3] as const;
  const [heldDirection, setHeldDirection] = useState<number | null>(null);
  const [sweeping, setSweeping] = useState(false);
  useEffect(() => {
    setSweepVirtualInput(heldDirection, sweeping);
    return () => setSweepVirtualInput(null, false);
  }, [heldDirection, sweeping]);
  return (
    <div className="mx-auto mt-3 flex w-full max-w-6xl items-end justify-between sm:hidden">
      <div className="grid w-36 grid-cols-3 gap-1" aria-label="移动方向">
        {directions.map((direction, index) =>
          direction === null ? <span key={index} /> : (
            <button
              key={direction}
              type="button"
              className="aspect-square rounded-full border border-white/20 bg-white/10 text-lg active:bg-white/30"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setHeldDirection(direction); }}
              onPointerUp={() => setHeldDirection(null)}
              onPointerCancel={() => setHeldDirection(null)}
              aria-label={`方向 ${direction}`}
            >{['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][direction]}</button>
          ),
        )}
      </div>
      <button
        type="button"
        className="h-24 w-24 rounded-full border-2 border-amber-200/50 bg-amber-800/40 font-serif text-lg active:bg-amber-700/70"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSweeping(true); }}
        onPointerUp={() => setSweeping(false)}
        onPointerCancel={() => setSweeping(false)}
      >挥帚</button>
    </div>
  );
}
