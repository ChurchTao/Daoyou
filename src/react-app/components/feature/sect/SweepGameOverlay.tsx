import {
  decodeSectTaskOutcome,
  readSweepSessionOutcome,
} from '@app/components/feature/sect/sectTaskOutcomeRegistry';
import { InkButton, InkNotice } from '@app/components/ui';
import type {
  SectSweepSessionData,
  SectTaskActionData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import {
  SWEEP_LEAF_COUNT,
  SWEEP_MAX_TICKS,
  SWEEP_TICK_RATE,
  type SweepGameState,
  type SweepInputSegment,
} from '@shared/engine/sect';
import { useCallback, useEffect, useRef, useState } from 'react';

const postJson = (
  body: unknown,
  idempotencyKey: string = crypto.randomUUID(),
): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify(body),
});

interface SweepGameOverlayProps {
  task: SectTaskViewData;
  initialSession?: SectSweepSessionData;
  close: () => void;
  onCompleted: () => Promise<unknown> | unknown;
  run: <T>(
    url: string,
    init: RequestInit,
    message: string,
  ) => Promise<T | undefined>;
}

export function SweepGameOverlay({
  task,
  initialSession,
  close,
  onCompleted,
  run,
}: SweepGameOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [session, setSession] = useState<SectSweepSessionData | undefined>(
    initialSession,
  );
  const [state, setState] = useState<SweepGameState>();
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const completedRef = useRef(false);

  const start = useCallback(async () => {
    setStarting(true);
    completedRef.current = false;
    setState(undefined);
    setOperationError(undefined);
    try {
      const result = await run<SectTaskActionData>(
        `/api/sects/current/tasks/${encodeURIComponent(task.definitionId)}/actions/start`,
        postJson({ input: {} }),
        `「${task.presentation.title}」勤务场已开启`,
      );
      if (!result) return;
      const decoded = decodeSectTaskOutcome(result.outcome);
      if (!decoded.ok) {
        setOperationError(decoded.error);
        return;
      }
      const nextSession = readSweepSessionOutcome(decoded.value);
      if (!nextSession) {
        setOperationError('宗门返回的清扫场次无法识别');
        return;
      }
      setSession(nextSession);
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : '清扫场开启失败',
      );
    } finally {
      setStarting(false);
    }
  }, [run, task.definitionId, task.presentation.title]);

  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void start();
    });
    return () => {
      cancelled = true;
    };
  }, [initialSession, start]);

  const complete = useCallback(
    async (trace: SweepInputSegment[]) => {
      if (!session || completedRef.current) return;
      completedRef.current = true;
      setSubmitting(true);
      setOperationError(undefined);
      try {
        const result = await run<SectTaskActionData>(
          `/api/sects/current/tasks/${encodeURIComponent(task.definitionId)}/actions/complete`,
          postJson(
            {
              input: {
                sessionId: session.sessionId,
                rulesVersion: session.rulesVersion,
                segments: trace,
              },
            },
            session.sessionId,
          ),
          `「${task.presentation.title}」已完成`,
        );
        if (result) {
          await onCompleted();
          close();
        } else completedRef.current = false;
      } catch (error) {
        completedRef.current = false;
        setOperationError(
          error instanceof Error ? error.message : '清扫结果提交失败',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      close,
      onCompleted,
      run,
      session,
      task.definitionId,
      task.presentation.title,
    ],
  );

  useEffect(() => {
    if (!session) return;
    const onMessage = (
      event: MessageEvent<{
        type?: string;
        sessionId?: string;
        rulesVersion?: number;
        data?: SweepGameState | SweepInputSegment[];
      }>,
    ) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.sessionId !== session.sessionId ||
        event.data?.rulesVersion !== session.rulesVersion
      )
        return;
      if (event.data.type === 'sect-sweep:state')
        setState(event.data.data as SweepGameState);
      if (event.data.type === 'sect-sweep:success')
        void complete(event.data.data as SweepInputSegment[]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [complete, session]);

  const sendVirtualInput = useCallback(
    (direction: number | null, sweeping: boolean) => {
      if (!session) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'sect-sweep:input',
          sessionId: session.sessionId,
          rulesVersion: session.rulesVersion,
          direction,
          sweeping,
        },
        window.location.origin,
      );
    },
    [session],
  );

  const remainingSeconds = Math.max(
    0,
    Math.ceil((SWEEP_MAX_TICKS - (state?.tick ?? 0)) / SWEEP_TICK_RATE),
  );
  const timedOut =
    state?.tick === SWEEP_MAX_TICKS && state.cleared < SWEEP_LEAF_COUNT;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-stone-950/95 p-2 text-stone-50 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${task.presentation.title}小游戏`}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 border-b border-white/15 pb-3">
        <div>
          <h2 className="font-serif text-xl">{task.presentation.title}</h2>
          <p className="text-xs text-stone-300">
            WASD / 方向键移动，空格挥帚；移动端使用下方控件。
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm tabular-nums">
          <span>
            落叶 {state?.cleared ?? 0}/{SWEEP_LEAF_COUNT}
          </span>
          <span>连扫 {state?.maxCombo ?? 0}</span>
          <span>余时 {remainingSeconds}s</span>
          <InkButton variant="secondary" onClick={close} disabled={submitting}>
            退出
          </InkButton>
        </div>
      </header>
      <div className="relative mx-auto mt-3 min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-sm border border-white/15 bg-stone-900 shadow-2xl">
        {session ? (
          <iframe
            ref={iframeRef}
            title={`${task.presentation.title}游戏画布`}
            className="absolute inset-0 h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            src={`/sect-sweep-runtime?${new URLSearchParams({
              sessionId: session.sessionId,
              seed: session.seed,
              rulesVersion: String(session.rulesVersion),
            }).toString()}`}
          />
        ) : null}
        {starting ? (
          <div className="absolute inset-0 grid place-items-center bg-stone-950/70">
            勤务场正在布置……
          </div>
        ) : null}
        {submitting ? (
          <div className="absolute inset-0 grid place-items-center bg-stone-950/70">
            正在验收清扫轨迹……
          </div>
        ) : null}
        {operationError && !starting && !submitting ? (
          <div className="absolute inset-0 grid place-items-center bg-stone-950/80 p-6 text-center">
            <InkNotice>
              {operationError}
              <InkButton onClick={() => void start()}>重新开启</InkButton>
            </InkNotice>
          </div>
        ) : null}
        {timedOut ? (
          <div className="absolute inset-0 grid place-items-center bg-stone-950/75 p-6 text-center">
            <InkNotice>
              时限已过，场内仍有落叶。此次不会消耗今日委托。
              <InkButton onClick={() => void start()}>重新清扫</InkButton>
            </InkNotice>
          </div>
        ) : null}
      </div>
      <MobileControls onInput={sendVirtualInput} />
    </div>
  );
}

function MobileControls({
  onInput,
}: {
  onInput: (direction: number | null, sweeping: boolean) => void;
}) {
  const directions = [7, 0, 1, 6, null, 2, 5, 4, 3] as const;
  const [heldDirection, setHeldDirection] = useState<number | null>(null);
  const [sweeping, setSweeping] = useState(false);
  useEffect(() => {
    onInput(heldDirection, sweeping);
    return () => onInput(null, false);
  }, [heldDirection, onInput, sweeping]);
  return (
    <div className="mx-auto mt-3 flex w-full max-w-6xl items-end justify-between sm:hidden">
      <div className="grid w-36 grid-cols-3 gap-1" aria-label="移动方向">
        {directions.map((direction, index) =>
          direction === null ? (
            <span key={index} />
          ) : (
            <button
              key={direction}
              type="button"
              className="aspect-square rounded-full border border-white/20 bg-white/10 text-lg active:bg-white/30"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setHeldDirection(direction);
              }}
              onPointerUp={() => setHeldDirection(null)}
              onPointerCancel={() => setHeldDirection(null)}
              aria-label={`方向 ${direction}`}
            >
              {['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][direction]}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        className="h-24 w-24 rounded-full border-2 border-amber-200/50 bg-amber-800/40 font-serif text-lg active:bg-amber-700/70"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setSweeping(true);
        }}
        onPointerUp={() => setSweeping(false)}
        onPointerCancel={() => setSweeping(false)}
      >
        挥帚
      </button>
    </div>
  );
}
