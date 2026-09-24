import {
  GameActivityFullscreenRetry,
  GameActivityLaunchGate,
  GameActivityLoadingOverlay,
  GameActivityOverlay,
  GameActivityRotationNotice,
  useGameActivityViewport,
} from '@app/components/feature/game-activity';
import {
  getSectPresentationForContext,
  useSectContextQuery,
  useSectTasksQuery,
} from '@app/components/feature/sect/sectResources';
import { createSectRoomNpcHref } from '@app/components/feature/sect/sectRoomNavigation';
import {
  decodeSectTaskOutcome,
  readSweepSessionOutcome,
} from '@app/components/feature/sect/sectTaskOutcomeRegistry';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import {
  readActivityImmersiveNavigationState,
  releaseActivityImmersiveMode,
  requestActivityImmersiveMode,
  shouldBlockActivityForPortrait,
  type ActivityImmersiveResult,
} from '@app/lib/gameActivityImmersive';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type {
  SectSweepSessionData,
  SectTaskActionData,
  SectTasksData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import type { SweepDirection, SweepGameProgress } from '@shared/engine/sect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  attachSweepPhaser,
  type SweepPhaserController,
} from './SweepPhaserRuntime';
import {
  resolveSweepActivityMode,
  sweepActivityMessage,
} from './sweepActivityState';

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

type SweepSettlement = { kind: 'practice' } | { kind: 'reward' };

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

export default function SectGateSweepPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SweepPhaserController | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const viewport = useGameActivityViewport();
  const context = useSectContextQuery();
  const { data: taskData, error: taskError } = useSectTasksQuery();
  const presentation = getSectPresentationForContext(context.data);
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const portraitBlocked = shouldBlockActivityForPortrait(viewport);
  const [immersiveAttempt, setImmersiveAttempt] = useState<
    ActivityImmersiveResult | undefined
  >(() => readActivityImmersiveNavigationState(location.state));
  const [fallbackAccepted, setFallbackAccepted] = useState(false);
  const [session, setSession] = useState<ActiveSweepSession>();
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState<SweepGameProgress>();
  const [settlement, setSettlement] = useState<SweepSettlement>();
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const fullscreenReady =
    !viewport.coarsePointer ||
    viewport.standalone ||
    viewport.fullscreenActive ||
    fallbackAccepted;
  const launchBlocked =
    viewport.coarsePointer && (!viewport.landscape || !fullscreenReady);
  const activityStarted = starting || started || Boolean(session);

  const beginPractice = useCallback(() => {
    setSession({
      kind: 'practice',
      seed: `practice:${crypto.randomUUID()}`,
    });
    setProgress(undefined);
    setSettlement(undefined);
    setOperationError(undefined);
    setStarted(true);
  }, []);

  const beginSession = useCallback(
    async (taskSnapshot?: SectTasksData) => {
      const mode = resolveSweepActivityMode(taskSnapshot);
      setStarting(true);
      setSession(undefined);
      setProgress(undefined);
      setSettlement(undefined);
      setOperationError(undefined);
      setStarted(true);
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
    if (launchBlocked || started || (!taskData && !taskError)) return;
    const timer = window.setTimeout(() => void beginSession(taskData), 0);
    return () => window.clearTimeout(timer);
  }, [beginSession, launchBlocked, started, taskData, taskError]);

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
        setSettlement({ kind: 'reward' });
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
    [mutate, pushToast, session],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !session) return;
    const controller = attachSweepPhaser({
      root,
      seed: session.seed,
      canvasLabel: presentation.terms.sweepCanvasLabel,
      touchControlsEnabled: false,
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
  }, [complete, presentation.terms.sweepCanvasLabel, session]);

  useEffect(() => {
    controllerRef.current?.setTouchControlsEnabled(
      viewport.coarsePointer &&
        !submitting &&
        !starting &&
        !portraitBlocked &&
        !settlement &&
        progress?.phase === 'playing',
    );
  }, [
    portraitBlocked,
    progress?.phase,
    session,
    settlement,
    starting,
    submitting,
    viewport.coarsePointer,
  ]);

  useEffect(
    () => () => {
      void releaseActivityImmersiveMode();
    },
    [],
  );

  const exit = async () => {
    await releaseActivityImmersiveMode();
    navigate(createSectRoomNpcHref('/game/sect/gate', 'facility'), {
      replace: true,
    });
  };

  const reset = () => {
    setSettlement(undefined);
    setOperationError(undefined);
    controllerRef.current?.reset();
  };

  const newGame = async () => {
    setStarted(true);
    await beginSession(taskData);
  };

  const retryImmersive = async () => {
    const result = await requestActivityImmersiveMode();
    setImmersiveAttempt(result);
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
      <GameImage
        src="/assets/sect/sweep/cloud-stair-courtyard.webp"
        alt=""
        className="pointer-events-none absolute -top-8 -left-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] max-w-none scale-110 object-cover object-center blur-xl"
        style={{ opacity: 0.55 }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[#101513]/35" aria-hidden="true" />

      <div ref={rootRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-[max(env(safe-area-inset-left),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]">
        <div className="pointer-events-auto rounded-full bg-[#18201c]/50 px-4 py-2 text-sm shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <span>
            {viewport.coarsePointer ? '叶' : '落叶'} {progress?.cleared ?? 0}/
            {progress?.totalLeaves ?? 4}
          </span>
          <span className="ml-3">
            {viewport.coarsePointer
              ? `${progress?.steps ?? 0}步`
              : `步数 ${progress?.steps ?? 0}`}
          </span>
          {!viewport.coarsePointer ? (
            <span className="ml-4 text-xs text-stone-300">
              {session?.kind === 'reward' ? '今日委托' : '自由练习'}
            </span>
          ) : null}
        </div>
        <div className="pointer-events-auto flex gap-2">
          {viewport.coarsePointer &&
          viewport.landscape &&
          !viewport.standalone &&
          !viewport.fullscreenActive &&
          session ? (
            <GameActivityFullscreenRetry onRetry={retryImmersive} />
          ) : null}
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

      {activityStarted && portraitBlocked ? (
        <GameActivityRotationNotice />
      ) : !activityStarted && launchBlocked ? (
        <GameActivityLaunchGate
          viewport={viewport}
          attempt={immersiveAttempt}
          instructions={
            <p>向任一方向推动摇杆，每次前进一步；收齐落叶后再踏入终点。</p>
          }
          exitLabel="返回山门"
          onRetry={retryImmersive}
          onContinue={() => setFallbackAccepted(true)}
          onExit={() => void exit()}
        />
      ) : starting || (!session && !operationError) ? (
        <GameActivityLoadingOverlay message="山门步道正在铺开……" />
      ) : submitting ? (
        <GameActivityLoadingOverlay message="正在验收清扫轨迹……" />
      ) : operationError ? (
        <GameActivityOverlay>
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
        </GameActivityOverlay>
      ) : settlement ? (
        <GameActivityOverlay>
          <p className="text-xl font-semibold">
            {settlement.kind === 'reward' ? '今日勤务已完成' : '清扫完成'}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            {settlement.kind === 'reward'
              ? '勤务回执已成，请回事务堂领取赏赐。'
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
        </GameActivityOverlay>
      ) : phaseFailure ? (
        <GameActivityOverlay>
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
        </GameActivityOverlay>
      ) : !progress ? (
        <GameActivityLoadingOverlay message="正在绘制山门格阵……" />
      ) : null}

      {!portraitBlocked && session && progress?.phase === 'playing' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(env(safe-area-inset-bottom),0.65rem)] text-center">
          <p className="inline-block rounded-full bg-black/45 px-4 py-2 text-xs text-stone-300 backdrop-blur-sm">
            {viewport.coarsePointer
              ? '推动左侧摇杆 · 收齐落叶后前往终点 · 不可返回'
              : sweepActivityMessage(
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
