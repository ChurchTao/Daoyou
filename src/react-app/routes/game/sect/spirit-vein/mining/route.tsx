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
  readMiningResultOutcome,
  readMiningSessionOutcome,
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
  SectMiningResultData,
  SectMiningSessionData,
  SectTaskActionData,
  SectTasksData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import {
  MINING_DURATION_MS,
  MINING_MAX_SCORE,
  type MiningCastInput,
} from '@shared/engine/sect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MiningDropButton } from './MiningDropButton';
import {
  attachMiningPhaser,
  type MiningGameProgress,
  type MiningPhaserController,
} from './MiningPhaserRuntime';
import { resolveMiningActivityMode } from './miningActivityState';

type ActiveMiningSession =
  | { kind: 'practice'; seed: string }
  | {
      kind: 'reward';
      seed: string;
      task: SectTaskViewData;
      server: SectMiningSessionData;
    };

interface MiningSettlement extends SectMiningResultData {
  kind: 'practice' | 'reward';
}

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

function localPracticeResult(
  progress: MiningGameProgress,
): SectMiningResultData {
  return {
    score: progress.score,
    maxScore: progress.maxScore,
    ratio: progress.maxScore > 0 ? progress.score / progress.maxScore : 0,
    ...(progress.tier ? { tier: progress.tier } : {}),
    qualified: Boolean(progress.tier),
    collected: progress.collected,
    destroyed: progress.destroyed,
    clearedAll: progress.collected + progress.destroyed === progress.total,
    ores: progress.ores,
  };
}

const MINING_ORE_LABELS = {
  spirit_crystal: '小型灵晶',
  copper_ore: '赤铜灵矿',
  dark_iron: '玄铁矿团',
  earth_essence: '地脉灵髓',
} as const;

function nextTierTarget(score: number, maxScore: number): string {
  const thresholds = [
    ['D', 0.2],
    ['C', 0.35],
    ['B', 0.5],
    ['A', 0.65],
    ['S', 0.8],
  ] as const;
  const next = thresholds.find(
    ([, ratio]) => score < Math.ceil(maxScore * ratio),
  );
  return next
    ? `距离 ${next[0]} 档还差 ${Math.max(0, Math.ceil(maxScore * next[1]) - score)} 分`
    : '已经达到最高档';
}

export default function SectSpiritVeinMiningPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MiningPhaserController | undefined>(undefined);
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
  const [session, setSession] = useState<ActiveMiningSession>();
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState<MiningGameProgress>();
  const [settlement, setSettlement] = useState<MiningSettlement>();
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
    async (snapshot?: SectTasksData) => {
      const mode = resolveMiningActivityMode(snapshot);
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
        const server = readMiningSessionOutcome(decoded.value);
        if (!server) throw new Error('宗门返回的灵矿采掘场次无法识别');
        setSession({
          kind: 'reward',
          seed: server.seed,
          task: mode.task,
          server,
        });
      } catch (reason) {
        setOperationError(
          reason instanceof Error ? reason.message : '灵矿采掘场开启失败',
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
    async (casts: MiningCastInput[], finalProgress: MiningGameProgress) => {
      if (!session) return;
      if (session.kind === 'practice') {
        setSettlement({
          kind: 'practice',
          ...localPracticeResult(finalProgress),
        });
        return;
      }
      setSubmitting(true);
      setOperationError(undefined);
      try {
        const result = await mutate<SectTaskActionData>(
          fetch(
            `/api/sects/current/tasks/${encodeURIComponent(session.task.definitionId)}/actions/complete`,
            postJson(
              {
                sessionId: session.server.sessionId,
                rulesVersion: session.server.rulesVersion,
                casts,
              },
              session.server.sessionId,
            ),
          ),
        );
        const decoded = decodeSectTaskOutcome(result.outcome);
        if (!decoded.ok) throw new Error(decoded.error);
        const miningResult = readMiningResultOutcome(decoded.value);
        if (!miningResult) throw new Error('宗门无法识别本次采掘成绩');
        setSettlement({ kind: 'reward', ...miningResult });
        pushToast({
          message: miningResult.qualified
            ? `灵矿采掘评定为 ${miningResult.tier} 档`
            : '本轮采掘尚未达到验收线',
          tone: miningResult.qualified ? 'success' : 'warning',
        });
      } catch (reason) {
        setOperationError(
          reason instanceof Error ? reason.message : '灵矿采掘结果提交失败',
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
    const controller = attachMiningPhaser({
      root,
      seed: session.seed,
      canvasLabel: `${presentation.facilityLabels.spirit_vein ?? '宗门灵脉'}灵索采矿游戏画布`,
      onState: setProgress,
      onComplete: (casts, finalProgress) => void complete(casts, finalProgress),
      onError: setOperationError,
    });
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      if (controllerRef.current === controller)
        controllerRef.current = undefined;
    };
  }, [complete, presentation.facilityLabels.spirit_vein, session]);

  useEffect(
    () => () => {
      void releaseActivityImmersiveMode();
    },
    [],
  );

  const exit = async () => {
    await releaseActivityImmersiveMode();
    navigate(createSectRoomNpcHref('/game/sect/spirit-vein', 'facility'), {
      replace: true,
    });
  };

  const newGame = async () => {
    setStarted(true);
    await beginSession(taskData);
  };

  const retryImmersive = async () => {
    const result = await requestActivityImmersiveMode();
    setImmersiveAttempt(result);
  };

  const remainingSeconds = Math.ceil(
    (progress?.remainingMs ?? MINING_DURATION_MS) / 1_000,
  );

  return (
    <div
      className="fixed inset-0 isolate overflow-hidden bg-[#07110f] text-stone-50"
      aria-label="灵索采矿小游戏"
    >
      <GameImage
        src="/assets/sect/mining/spirit-vein-cavern.webp"
        alt=""
        className="pointer-events-none absolute -top-8 -left-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] max-w-none scale-110 object-cover object-center blur-xl"
        style={{ opacity: 0.55 }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[#06100e]/35" aria-hidden="true" />

      <div ref={rootRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-[max(env(safe-area-inset-left),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]">
        <div className="pointer-events-auto rounded-full bg-[#10201b]/65 px-4 py-2 text-sm shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <span>
            {viewport.coarsePointer ? '分' : '得分'} {progress?.score ?? 0}
          </span>
          <span className="ml-3">
            {viewport.coarsePointer ? '矿' : '灵矿'} {progress?.collected ?? 0}
            /16
          </span>
          {progress?.destroyed ? (
            <span className="ml-3 text-orange-200">
              炸毁 {progress.destroyed}
            </span>
          ) : null}
          <span className="ml-3">
            {viewport.coarsePointer ? '' : '剩余 '}
            {remainingSeconds}s
          </span>
          {!viewport.coarsePointer ? (
            <span className="ml-4 text-xs text-emerald-100/75">
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
            className="rounded-full bg-[#10201b]/65 px-4 py-2 text-sm shadow-lg ring-1 ring-white/10 backdrop-blur-md transition hover:bg-[#10201b]/85 disabled:opacity-50"
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
            <p>等待灵索对准矿藏，点击“放索”；炸药会波及周围矿石。</p>
          }
          exitLabel="返回灵脉"
          onRetry={retryImmersive}
          onContinue={() => setFallbackAccepted(true)}
          onExit={() => void exit()}
        />
      ) : starting || (!session && !operationError) ? (
        <GameActivityLoadingOverlay message="灵索与矿场封签正在校准……" />
      ) : submitting ? (
        <GameActivityLoadingOverlay message="正在验收灵索轨迹与矿藏……" />
      ) : operationError ? (
        <GameActivityOverlay>
          <InkNotice>{operationError}</InkNotice>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <InkButton onClick={() => void newGame()}>重新开启</InkButton>
            <InkButton variant="secondary" onClick={beginPractice}>
              改为自由练习
            </InkButton>
            <InkButton variant="secondary" onClick={() => void exit()}>
              返回灵脉
            </InkButton>
          </div>
        </GameActivityOverlay>
      ) : settlement ? (
        <GameActivityOverlay>
          <p className="text-xl font-semibold">
            {settlement.qualified
              ? `采掘评定 · ${settlement.tier} 档`
              : '本轮采掘未达标'}
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            得分 {settlement.score}/{settlement.maxScore}，
            {nextTierTarget(settlement.score, settlement.maxScore)}。
          </p>
          {settlement.ores.length ? (
            <p className="mt-2 text-sm leading-7 text-stone-300">
              采得：
              {settlement.ores
                .map(
                  (ore) =>
                    `${MINING_ORE_LABELS[ore.kind]} ×${ore.count}（${ore.score}分）`,
                )
                .join('、')}
            </p>
          ) : (
            <p className="mt-2 text-sm text-stone-400">本轮未采得灵矿。</p>
          )}
          {settlement.destroyed ? (
            <p className="mt-2 text-sm text-orange-200/80">
              爆破波及灵矿 ×{settlement.destroyed}，不会计入得分。
            </p>
          ) : null}
          {settlement.rewardSummary?.length ? (
            <div className="mx-auto mt-3 max-w-sm text-sm leading-7 text-emerald-100">
              {settlement.rewardSummary.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-6 text-stone-400">
            {settlement.kind === 'practice'
              ? '自由练习不会产生奖励。'
              : settlement.qualified
                ? '采掘回执已成，请回事务堂领取赏赐。'
                : '委托仍在名下，可以重新开启采掘场。'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <InkButton variant="primary" onClick={() => void exit()}>
              返回灵脉
            </InkButton>
            <InkButton
              variant="secondary"
              onClick={() => {
                if (settlement.qualified && settlement.kind === 'reward')
                  beginPractice();
                else void newGame();
              }}
            >
              {settlement.qualified && settlement.kind === 'reward'
                ? '自由练习'
                : '再来一局'}
            </InkButton>
          </div>
        </GameActivityOverlay>
      ) : null}

      {viewport.coarsePointer && session && progress && !settlement ? (
        <MiningDropButton
          disabled={
            submitting || starting || portraitBlocked || progress.hookBusy
          }
          onDrop={() => controllerRef.current?.drop()}
        />
      ) : null}

      {!portraitBlocked && session && progress && !settlement ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(env(safe-area-inset-bottom),0.65rem)] text-center">
          <p className="inline-block rounded-full bg-black/50 px-4 py-2 text-xs text-stone-200 backdrop-blur-sm">
            看准摆角后点击“放索” ·{' '}
            {nextTierTarget(progress.score, MINING_MAX_SCORE)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
