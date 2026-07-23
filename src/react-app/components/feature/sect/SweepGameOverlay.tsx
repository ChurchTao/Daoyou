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
  type SweepDirection,
  type SweepGameProgress,
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
  const [state, setState] = useState<SweepGameProgress>();
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
    async (moves: SweepDirection[]) => {
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
                moves,
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
        data?: SweepGameProgress | SweepDirection[] | string;
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
        setState(event.data.data as SweepGameProgress);
      if (event.data.type === 'sect-sweep:success')
        void complete(event.data.data as SweepDirection[]);
      if (event.data.type === 'sect-sweep:error')
        setOperationError(String(event.data.data));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [complete, session]);

  const sendMove = useCallback(
    (direction: SweepDirection) => {
      if (!session) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'sect-sweep:move',
          sessionId: session.sessionId,
          rulesVersion: session.rulesVersion,
          direction,
        },
        window.location.origin,
      );
    },
    [session],
  );

  const reset = useCallback(() => {
    if (!session || submitting) return;
    completedRef.current = false;
    setOperationError(undefined);
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'sect-sweep:reset',
        sessionId: session.sessionId,
        rulesVersion: session.rulesVersion,
      },
      window.location.origin,
    );
  }, [session, submitting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = {
        ArrowUp: 'up',
        KeyW: 'up',
        ArrowRight: 'right',
        KeyD: 'right',
        ArrowDown: 'down',
        KeyS: 'down',
        ArrowLeft: 'left',
        KeyA: 'left',
      }[event.code] as SweepDirection | undefined;
      if (!direction || event.repeat) return;
      event.preventDefault();
      sendMove(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sendMove]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-stone-950/95 p-2 text-stone-50 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${task.presentation.title}小游戏`}
    >
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-3 border-b border-white/15 pb-3 sm:items-center">
        <div>
          <h2 className="font-serif text-xl">{task.presentation.title}</h2>
          <p className="text-xs text-stone-300">
            逐格走过山门，落叶会自动清扫；已经走过的格子不可返回。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm tabular-nums sm:gap-4">
          <span>
            落叶 {state?.cleared ?? 0}/{state?.totalLeaves ?? 12}
          </span>
          <span>步数 {state?.steps ?? 0}</span>
          <InkButton
            variant="secondary"
            onClick={reset}
            disabled={!session || starting || submitting}
          >
            重走
          </InkButton>
          <InkButton variant="secondary" onClick={close} disabled={submitting}>
            退出
          </InkButton>
        </div>
      </header>
      <div className="relative mx-auto mt-3 aspect-[25/14] min-h-0 w-full max-w-6xl flex-none overflow-hidden rounded-sm border border-white/15 bg-stone-900 shadow-2xl sm:aspect-auto sm:flex-1">
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
      </div>
      <MobileControls onMove={sendMove} />
    </div>
  );
}

function MobileControls({ onMove }: { onMove: (direction: SweepDirection) => void }) {
  const directions = [
    null,
    'up',
    null,
    'left',
    null,
    'right',
    null,
    'down',
    null,
  ] as const;
  const labels: Record<SweepDirection, string> = {
    up: '↑',
    right: '→',
    down: '↓',
    left: '←',
  };
  return (
    <div className="mx-auto mt-3 flex w-full max-w-6xl justify-center sm:hidden">
      <div className="grid w-40 grid-cols-3 gap-1" aria-label="移动方向">
        {directions.map((direction, index) =>
          direction === null ? (
            <span key={index} />
          ) : (
            <button
              key={direction}
              type="button"
              className="aspect-square rounded-full border border-white/20 bg-white/10 text-lg active:bg-white/30"
              onClick={() => onMove(direction)}
              aria-label={`向${{ up: '上', right: '右', down: '下', left: '左' }[direction]}移动`}
            >
              {labels[direction]}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
