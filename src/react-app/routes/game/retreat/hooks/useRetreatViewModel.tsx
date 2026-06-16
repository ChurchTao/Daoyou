import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import { usePlayerStateView, type PlayerStateView } from '@app/lib/player-state/selectors';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { findCurrentMajorBreakthroughTask } from '@app/lib/tasks/taskClient';
import {
  calculateBreakthroughChance,
  getNextStage,
} from '@server/utils/breakthroughCalculator';
import type {
  RetreatAction,
  RetreatResultData,
} from '@shared/contracts/retreat';
import type { TaskInstance } from '@shared/types/task';
import { getRetreatQiCost } from '@shared/config/qiSystem';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  type ReincarnateContextData,
  consumeRetreatStream,
  isSuccessfulBreakthrough,
} from '../lib/retreatStream';
import {
  buildRetreatEfficiencyModel,
  type RetreatEfficiencyModel,
} from '../lib/retreatEfficiency';

export interface CultivationProgressData {
  cultivation_exp: number;
  exp_cap: number;
  comprehension_insight: number;
  percent: number;
  canBreakthrough: boolean;
  breakthroughType: 'forced' | 'normal' | 'perfect' | null;
}

export interface BreakthroughChancePreviewData {
  baseChance: number;
  finalChance: number;
  buffBonus: number;
  recommendation: string;
}

export interface UseRetreatViewModelReturn {
  cultivator: PlayerStateView['cultivator'];
  isLoading: boolean;
  note: string | undefined;
  remainingLifespan: number;
  cultivationProgress: CultivationProgressData | null;
  retreatEfficiency: RetreatEfficiencyModel | null;
  breakthroughPreview: BreakthroughChancePreviewData | null;
  currentMajorTask: TaskInstance | null;
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
  tasksLoading: boolean;
  taskError: string | undefined;

  retreatYears: string;
  handleRetreatYearsChange: (value: string) => void;

  retreatLoading: boolean;
  retreatResult: RetreatResultData | null;
  retreatResultOpen: boolean;
  retreatResultStreaming: boolean;
  celebrationTick: number;
  showBreakthroughConfirm: boolean;

  handleRetreat: () => Promise<void>;
  handleBreakthroughClick: () => void;
  handleBreakthrough: () => Promise<void>;
  closeBreakthroughConfirm: () => void;
  closeRetreatResult: () => void;
  handleGoReincarnate: () => void;
}

interface RetreatFailurePayload {
  error?: string;
  errorCode?: string;
  message?: string;
}

type RetreatRequestOutcome =
  | { ok: true }
  | { ok: false; payload: RetreatFailurePayload | null };

export function useRetreatViewModel(): UseRetreatViewModelReturn {
  const { cultivator, isLoading, note } = usePlayerStateView();
  const { pushToast } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();
  const { consumeStateMeta } = usePlayerStateActions();
  const navigate = useNavigate();
  const {
    tasks,
    loading: tasksLoading,
    error: taskError,
  } = useTaskList(cultivator?.id);
  const [retreatYears, setRetreatYears] = useState('10');
  const [retreatResult, setRetreatResult] = useState<RetreatResultData | null>(
    null,
  );
  const [retreatResultOpen, setRetreatResultOpen] = useState(false);
  const [retreatResultStreaming, setRetreatResultStreaming] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [retreatLoading, setRetreatLoading] = useState(false);
  const [showBreakthroughConfirm, setShowBreakthroughConfirm] = useState(false);
  const [reincarnateContext, setReincarnateContext] =
    useState<ReincarnateContextData | null>(null);

  const remainingLifespan = useMemo(() => {
    if (!cultivator) return 0;
    return Math.max(cultivator.lifespan - cultivator.age, 0);
  }, [cultivator]);

  const cultivationProgress = useMemo((): CultivationProgressData | null => {
    if (!cultivator?.cultivation_progress) return null;

    const progress = cultivator.cultivation_progress;
    const percent = Math.floor(
      (progress.cultivation_exp / progress.exp_cap) * 100,
    );
    const canBreakthrough = percent >= 60;

    let breakthroughType: 'forced' | 'normal' | 'perfect' | null = null;
    if (percent >= 100 && progress.comprehension_insight >= 50) {
      breakthroughType = 'perfect';
    } else if (percent >= 80) {
      breakthroughType = 'normal';
    } else if (percent >= 60) {
      breakthroughType = 'forced';
    }

    return {
      cultivation_exp: progress.cultivation_exp,
      exp_cap: progress.exp_cap,
      comprehension_insight: progress.comprehension_insight,
      percent,
      canBreakthrough,
      breakthroughType,
    };
  }, [cultivator]);

  const retreatEfficiency = useMemo((): RetreatEfficiencyModel | null => {
    if (!cultivator) return null;
    return buildRetreatEfficiencyModel({
      cultivator,
      retreatYears,
    });
  }, [cultivator, retreatYears]);

  const nextBreakthrough = useMemo(() => {
    if (!cultivator) {
      return null;
    }

    return getNextStage(cultivator.realm, cultivator.realm_stage);
  }, [cultivator]);

  const isMajorBreakthrough = Boolean(
    cultivator &&
    nextBreakthrough &&
    nextBreakthrough.realm !== cultivator.realm,
  );

  const currentMajorTask = useMemo(
    () => findCurrentMajorBreakthroughTask(cultivator, tasks),
    [cultivator, tasks],
  );

  const majorBreakthroughBlocked = Boolean(
    isMajorBreakthrough &&
    (!currentMajorTask || currentMajorTask.status !== 'completed'),
  );

  const breakthroughPreview =
    useMemo((): BreakthroughChancePreviewData | null => {
      if (
        !cultivator ||
        !cultivationProgress?.canBreakthrough ||
        (isMajorBreakthrough && majorBreakthroughBlocked)
      ) {
        return null;
      }

      try {
        const result = calculateBreakthroughChance(cultivator);
        const baseChance = Math.min(
          1,
          Math.max(
            0.05,
            result.modifiers.baseChance *
              result.modifiers.realmDifficulty *
              result.modifiers.progressMultiplier *
              result.modifiers.insightMultiplier *
              result.modifiers.demonPenalty +
              result.modifiers.toxicityPenalty,
          ),
        );

        return {
          baseChance,
          finalChance: result.chance,
          buffBonus: result.modifiers.pillBonus + result.modifiers.fateBonus,
          recommendation: result.recommendation,
        };
      } catch {
        return null;
      }
    }, [
      cultivator,
      cultivationProgress?.canBreakthrough,
      isMajorBreakthrough,
      majorBreakthroughBlocked,
    ]);

  const handleRetreatYearsChange = useCallback((value: string) => {
    const numeric = value.replace(/[^\d]/g, '');
    setRetreatYears(numeric);
  }, []);

  const streamRetreatAction = useCallback(
    async (body: {
      action: RetreatAction;
      years?: number;
    }): Promise<RetreatRequestOutcome> => {
      const cultivatorSnapshot = cultivator
        ? {
            name: cultivator.name,
            realm: cultivator.realm,
            realm_stage: cultivator.realm_stage,
          }
        : null;

      setRetreatLoading(true);
      setRetreatResult(null);
      setRetreatResultOpen(false);
      setRetreatResultStreaming(false);
      setReincarnateContext(null);

      try {
        const response = await fetch('/api/cultivator/retreat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const payload = (await response
            .json()
            .catch(() => null)) as RetreatFailurePayload | null;
          return {
            ok: false,
            payload,
          };
        }

        await consumeRetreatStream(response, {
          cultivatorSnapshot,
          onResult: (result) => {
            setRetreatResult(result);
            setRetreatResultOpen(true);
            setRetreatResultStreaming(Boolean(result.storyType));

            if (isSuccessfulBreakthrough(result)) {
              setCelebrationTick((current) => current + 1);
            }
          },
          onStoryUpdate: setRetreatResult,
          onReincarnateContext: setReincarnateContext,
          onStateEvents: (events) => {
            if (events.length === 0) return;
            void consumeStateMeta(
              {
                cultivatorId: events[0].cultivatorId,
                globalVersion: Math.max(
                  ...events.map((event) => event.globalVersion),
                ),
                domainVersions: Object.fromEntries(
                  events.map((event) => [event.domain, event.domainVersion]),
                ),
                events,
              },
              { deferRecovery: true },
            );
          },
          onError: (message) => {
            setRetreatResultStreaming(false);
            pushToast({
              message,
              tone: 'warning',
            });
          },
        });

        return { ok: true };
      } finally {
        setRetreatResultStreaming(false);
        setRetreatLoading(false);
      }
    },
    [consumeStateMeta, cultivator, pushToast],
  );

  const handleRetreat = useCallback(async () => {
    if (!cultivator) return;

    const parsedYears = Number(retreatYears || '0');
    if (!Number.isFinite(parsedYears) || parsedYears <= 0) {
      pushToast({
        message: '闭关年限似乎不对哦，道友请三思而行',
        tone: 'warning',
      });
      return;
    }

    openQiActionConfirm({
      actionName: '闭关修炼',
      qiCost: getRetreatQiCost(parsedYears),
      confirmLabel: '入定闭关',
      onConfirm: async () => {
        try {
          const outcome = await streamRetreatAction({
            action: 'cultivate',
            years: parsedYears,
          });

          if (!outcome.ok) {
            throw new Error(getQiErrorMessage(outcome.payload, '闭关失败'));
          }
        } catch (error) {
          pushToast({
            message:
              error instanceof Error ? error.message : '闭关失败，请稍后再试',
            tone: 'danger',
          });
        }
      },
    });
  }, [
    cultivator,
    openQiActionConfirm,
    pushToast,
    streamRetreatAction,
    retreatYears,
  ]);

  const handleBreakthroughClick = useCallback(() => {
    if (isMajorBreakthrough && majorBreakthroughBlocked) {
      pushToast({
        message: tasksLoading
          ? '破境卷宗仍在整理，请稍后再试。'
          : '先完成当前破境任务，再回静室正式冲关。',
        tone: 'warning',
      });
      return;
    }

    setShowBreakthroughConfirm(true);
  }, [isMajorBreakthrough, majorBreakthroughBlocked, pushToast, tasksLoading]);

  const closeBreakthroughConfirm = useCallback(() => {
    setShowBreakthroughConfirm(false);
  }, []);

  const handleBreakthrough = useCallback(async () => {
    if (!cultivator) return;

    setShowBreakthroughConfirm(false);

    try {
      const outcome = await streamRetreatAction({
        action: 'breakthrough',
      });

      if (!outcome.ok) {
        if (outcome.payload?.errorCode === 'MAJOR_BREAKTHROUGH_TASK_REQUIRED') {
          pushToast({
            message:
              typeof outcome.payload.error === 'string'
                ? outcome.payload.error
                : '大境界突破仍需先完成破境任务',
            tone: 'warning',
          });
          return;
        }

        throw new Error(getQiErrorMessage(outcome.payload, '突破失败'));
      }
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '突破失败，请稍后再试',
        tone: 'danger',
      });
    }
  }, [cultivator, pushToast, streamRetreatAction]);

  const closeRetreatResult = useCallback(() => {
    if (retreatResultStreaming || retreatResult?.depleted) {
      return;
    }

    setRetreatResultOpen(false);
    setRetreatResult(null);
    setReincarnateContext(null);
  }, [retreatResult, retreatResultStreaming]);

  const handleGoReincarnate = useCallback(() => {
    if (reincarnateContext && typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'reincarnateContext',
        JSON.stringify(reincarnateContext),
      );
    }
    navigate('/game/reincarnate');
  }, [navigate, reincarnateContext]);

  return {
    cultivator,
    isLoading,
    note,
    remainingLifespan,
    cultivationProgress,
    retreatEfficiency,
    breakthroughPreview,
    currentMajorTask,
    isMajorBreakthrough,
    majorBreakthroughBlocked,
    tasksLoading,
    taskError,
    retreatYears,
    handleRetreatYearsChange,
    retreatLoading,
    retreatResult,
    retreatResultOpen,
    retreatResultStreaming,
    celebrationTick,
    showBreakthroughConfirm,
    handleRetreat,
    handleBreakthroughClick,
    handleBreakthrough,
    closeBreakthroughConfirm,
    closeRetreatResult,
    handleGoReincarnate,
  };
}
