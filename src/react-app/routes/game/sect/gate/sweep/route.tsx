import {
  useSectCurrentQuery,
  useSectPresentation,
  useSectResourceQuery,
} from '@app/components/feature/sect/SectQueryProvider';
import {
  decodeSectTaskOutcome,
  readSweepSessionOutcome,
} from '@app/components/feature/sect/sectTaskOutcomeRegistry';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectTasks } from '@app/lib/sect/sectClient';
import type {
  SectSweepSessionData,
  SectTaskActionData,
  SectTasksData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import type { SweepDirection, SweepGameProgress } from '@shared/engine/sect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  attachSweepPhaser,
  type SweepPhaserController,
} from './SweepPhaserRuntime';
import {
  resolveSweepActivityMode,
  sweepActivityMessage,
} from './sweepActivityState';
import {
  readSweepViewportState,
  releaseSweepImmersiveMode,
  requestSweepImmersiveMode,
  shouldBlockSweepForPortrait,
} from './sweepImmersive';

type ActiveSweepSession =
  | {
      kind: 'practice';
      seed: string;
    }
  | {
      kind: 'reward';
      seed: string;
      task: SectTaskViewData;
      server: SectSweepSessionData;
    };

type SweepSettlement =
  { kind: 'practice' } | { kind: 'reward'; rewardSummary: string };

function postJson(
  input: Record<string, unknown>,
  idempotencyKey: string = crypto.randomUUID(),
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ input }),
  };
}

function useSweepLandscapeGate() {
  const [viewport, setViewport] = useState(() => readSweepViewportState());

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const landscape = window.matchMedia('(orientation: landscape)');
    const update = () => setViewport(readSweepViewportState());
    coarse.addEventListener('change', update);
    landscape.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', update);
    return () => {
      coarse.removeEventListener('change', update);
      landscape.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', update);
    };
  }, []);

  return shouldBlockSweepForPortrait(viewport);
}

export default function SectGateSweepPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SweepPhaserController | undefined>(undefined);
  const startedRef = useRef(false);
  const navigate = useNavigate();
  const {
    data: taskData,
    error: taskError,
    reload: reloadTasks,
  } = useSectResourceQuery('tasks', fetchSectTasks);
  const { invalidate: invalidateCurrent } = useSectCurrentQuery();
  const presentation = useSectPresentation();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const portraitBlocked = useSweepLandscapeGate();
  const [session, setSession] = useState<ActiveSweepSession>();
  const [progress, setProgress] = useState<SweepGameProgress>();
  const [settlement, setSettlement] = useState<SweepSettlement>();
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string>();

  const beginPractice = useCallback(() => {
    setSession({
      kind: 'practice',
      seed: `practice:${crypto.randomUUID()}`,
    });
    setProgress(undefined);
    setSettlement(undefined);
    setOperationError(undefined);
    startedRef.current = true;
  }, []);

  const beginSession = useCallback(
    async (taskSnapshot?: SectTasksData) => {
      const mode = resolveSweepActivityMode(taskSnapshot);
      setStarting(true);
      setSession(undefined);
      setProgress(undefined);
      setSettlement(undefined);
      setOperationError(undefined);
      startedRef.current = true;
      if (mode.kind === 'practice') {
        beginPractice();
        setStarting(false);
        return;
      }
      try {
        const result = await mutate<SectTaskActionData>(
          fetch(
            `/api/sects/current/tasks/${encodeURIComponent(mode.task.definitionId)}/actions/start`,
            postJson({}),
          ),
        );
        const decoded = decodeSectTaskOutcome(result.outcome);
        if (!decoded.ok) throw new Error(decoded.error);
        const server = readSweepSessionOutcome(decoded.value);
        if (!server) throw new Error('宗门返回的清扫场次无法识别');
        setSession({
          kind: 'reward',
          seed: server.seed,
          task: mode.task,
          server,
        });
      } catch (reason) {
        setOperationError(
          reason instanceof Error ? reason.message : '清扫场开启失败',
        );
      } finally {
        setStarting(false);
      }
    },
    [beginPractice, mutate],
  );

  useEffect(() => {
    if (portraitBlocked || startedRef.current || (!taskData && !taskError))
      return;
    void beginSession(taskData);
  }, [beginSession, portraitBlocked, taskData, taskError]);

  const complete = useCallback(
    async (moves: SweepDirection[]) => {
      if (!session) return;
      if (session.kind === 'practice') {
        setSettlement({ kind: 'practice' });
        return;
      }
      setSubmitting(true);
      setOperationError(undefined);
      try {
        await mutate<SectTaskActionData>(
          fetch(
            `/api/sects/current/tasks/${encodeURIComponent(session.task.definitionId)}/actions/complete`,
            postJson(
              {
                sessionId: session.server.sessionId,
                rulesVersion: session.server.rulesVersion,
                moves,
              },
              session.server.sessionId,
            ),
          ),
        );
        await Promise.all([reloadTasks(), invalidateCurrent()]);
        setSettlement({
          kind: 'reward',
          rewardSummary: session.task.presentation.rewardSummary,
        });
        pushToast({
          message: `「${session.task.presentation.title}」已完成`,
          tone: 'success',
        });
      } catch (reason) {
        setOperationError(
          reason instanceof Error ? reason.message : '清扫结果提交失败',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [invalidateCurrent, mutate, pushToast, reloadTasks, session],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !session || portraitBlocked) return;
    const controller = attachSweepPhaser({
      root,
      seed: session.seed,
      canvasLabel: presentation.terms.sweepCanvasLabel,
      onState: setProgress,
      onSuccess: (moves) => void complete(moves),
      onError: setOperationError,
    });
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      if (controllerRef.current === controller)
        controllerRef.current = undefined;
    };
  }, [complete, portraitBlocked, presentation.terms.sweepCanvasLabel, session]);

  useEffect(
    () => () => {
      void releaseSweepImmersiveMode();
    },
    [],
  );

  const exit = async () => {
    await releaseSweepImmersiveMode();
    navigate('/game/sect/gate', { replace: true });
  };

  const reset = () => {
    setSettlement(undefined);
    setOperationError(undefined);
    controllerRef.current?.reset();
  };

  const newGame = async () => {
    startedRef.current = true;
    const refreshed = await reloadTasks();
    await beginSession(refreshed ?? taskData);
  };

  const retryImmersive = async () => {
    await requestSweepImmersiveMode();
  };

  const phaseFailure =
    progress?.phase === 'failed'
      ? progress.failureReason === 'end_too_early'
        ? '落叶尚未收齐，终点踏得太早了。'
        : '这条路线已经无路可走。'
      : undefined;
  const mode = resolveSweepActivityMode(taskData);

  return (
    <div
      className="fixed inset-0 isolate overflow-hidden bg-[#141918] text-stone-50"
      aria-label={`${presentation.terms.sweepActivity}小游戏`}
    >
      <div
        className="absolute -inset-8 scale-110 bg-cover bg-center opacity-55 blur-xl"
        style={{
          backgroundImage:
            "url('/assets/sect/sweep/cloud-stair-courtyard.webp')",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[#101513]/35" aria-hidden="true" />

      {!portraitBlocked ? (
        <div ref={rootRef} className="absolute inset-0" />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-[max(env(safe-area-inset-left),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]">
        <div className="pointer-events-auto rounded-full bg-[#18201c]/50 px-4 py-2 text-sm shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <span>
            落叶 {progress?.cleared ?? 0}/{progress?.totalLeaves ?? 4}
          </span>
          <span className="ml-4">步数 {progress?.steps ?? 0}</span>
          <span className="ml-4 text-xs text-stone-300">
            {session?.kind === 'reward' ? '今日委托' : '自由练习'}
          </span>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            className="rounded-full bg-[#18201c]/50 px-4 py-2 text-sm shadow-lg ring-1 ring-white/10 backdrop-blur-md transition hover:bg-[#18201c]/75 disabled:opacity-50"
            onClick={reset}
            disabled={!session || submitting || starting}
          >
            重走
          </button>
          <button
            type="button"
            className="rounded-full bg-[#18201c]/50 px-4 py-2 text-sm shadow-lg ring-1 ring-white/10 backdrop-blur-md transition hover:bg-[#18201c]/75 disabled:opacity-50"
            onClick={() => void exit()}
            disabled={submitting}
          >
            退出
          </button>
        </div>
      </div>

      {portraitBlocked ? (
        <FullscreenNotice>
          <p className="text-lg font-semibold">请将设备旋转为横屏</p>
          <p className="mt-2 text-sm leading-7 text-stone-300">
            棋盘会在横屏后开启，避免格子缩得过小。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <InkButton variant="primary" onClick={() => void retryImmersive()}>
              进入横屏全屏
            </InkButton>
            <InkButton variant="secondary" onClick={() => void exit()}>
              返回山门
            </InkButton>
          </div>
        </FullscreenNotice>
      ) : starting || (!session && !operationError) ? (
        <FullscreenNotice>
          <p className="loading-tip">山门步道正在铺开……</p>
        </FullscreenNotice>
      ) : submitting ? (
        <FullscreenNotice>
          <p className="loading-tip">正在验收清扫轨迹……</p>
        </FullscreenNotice>
      ) : operationError ? (
        <FullscreenNotice>
          <InkNotice>{operationError}</InkNotice>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <InkButton onClick={() => void newGame()}>重新开启</InkButton>
            <InkButton variant="secondary" onClick={beginPractice}>
              改为自由练习
            </InkButton>
            <InkButton variant="secondary" onClick={() => void exit()}>
              返回山门
            </InkButton>
          </div>
        </FullscreenNotice>
      ) : settlement ? (
        <FullscreenNotice>
          <p className="text-xl font-semibold">
            {settlement.kind === 'reward' ? '今日勤务已完成' : '清扫完成'}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            {settlement.kind === 'reward'
              ? `${settlement.rewardSummary}已经记入宗门卷宗。`
              : '这是一局自由练习，没有产生任务奖励。'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <InkButton variant="primary" onClick={() => void exit()}>
              返回山门
            </InkButton>
            <InkButton variant="secondary" onClick={() => void newGame()}>
              再来一局
            </InkButton>
          </div>
        </FullscreenNotice>
      ) : phaseFailure ? (
        <FullscreenNotice>
          <p className="text-xl font-semibold">此路不通</p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            {phaseFailure}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <InkButton variant="primary" onClick={reset}>
              重走当前棋盘
            </InkButton>
            <InkButton variant="secondary" onClick={() => void exit()}>
              返回山门
            </InkButton>
          </div>
        </FullscreenNotice>
      ) : !progress ? (
        <FullscreenNotice>
          <p className="loading-tip">正在绘制山门格阵……</p>
        </FullscreenNotice>
      ) : null}

      {!portraitBlocked && session && progress?.phase === 'playing' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(env(safe-area-inset-bottom),0.65rem)] text-center">
          <p className="inline-block rounded-full bg-black/45 px-4 py-2 text-xs text-stone-300 backdrop-blur-sm">
            {sweepActivityMessage(
              session.kind === 'reward'
                ? { kind: 'reward', task: session.task }
                : mode.kind === 'practice'
                  ? mode
                  : {
                      kind: 'practice',
                      reason: 'unavailable',
                    },
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FullscreenNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/72 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}
