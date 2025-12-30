'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import type {
  BreakthroughResult,
  CultivationResult,
} from '@/engine/cultivation/CultivationEngine';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

export interface RetreatResultData {
  summary: BreakthroughResult['summary'] | CultivationResult['summary'];
  story?: string;
  storyType?: 'breakthrough' | 'lifespan' | null;
  action?: 'cultivate' | 'breakthrough';
  depleted?: boolean;
}

export interface CultivationProgressData {
  cultivation_exp: number;
  exp_cap: number;
  comprehension_insight: number;
  percent: number;
  canBreakthrough: boolean;
  breakthroughType: 'forced' | 'normal' | 'perfect' | null;
}

export interface UseRetreatViewModelReturn {
  // 数据
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  isLoading: boolean;
  note: string | undefined;
  remainingLifespan: number;
  cultivationProgress: CultivationProgressData | null;

  // 表单状态
  retreatYears: string;
  setRetreatYears: (years: string) => void;
  handleRetreatYearsChange: (value: string) => void;

  // 操作状态
  retreatLoading: boolean;
  retreatResult: RetreatResultData | null;
  showBreakthroughConfirm: boolean;

  // 业务操作
  handleRetreat: () => Promise<void>;
  handleBreakthroughClick: () => void;
  handleBreakthrough: () => Promise<void>;
  closeBreakthroughConfirm: () => void;
  handleGoReincarnate: () => void;
  clearRetreatResult: () => void;
}

/**
 * 洞府页面 ViewModel
 * 封装所有修炼和突破相关业务逻辑
 */
export function useRetreatViewModel(): UseRetreatViewModelReturn {
  const { cultivator, isLoading, refresh, note } = useCultivator();
  const { pushToast } = useInkUI();
  const router = useRouter();

  // 表单状态
  const [retreatYears, setRetreatYears] = useState('10');

  // 结果状态
  const [retreatResult, setRetreatResult] = useState<RetreatResultData | null>(
    null,
  );

  // 操作状态
  const [retreatLoading, setRetreatLoading] = useState(false);
  const [showBreakthroughConfirm, setShowBreakthroughConfirm] = useState(false);

  // 计算剩余寿元
  const remainingLifespan = useMemo(() => {
    if (!cultivator) return 0;
    return Math.max(cultivator.lifespan - cultivator.age, 0);
  }, [cultivator]);

  // 计算修为进度
  const cultivationProgress = useMemo((): CultivationProgressData | null => {
    if (!cultivator?.cultivation_progress) return null;

    const progress = cultivator.cultivation_progress;
    const percent = Math.floor(
      (progress.cultivation_exp / progress.exp_cap) * 100,
    );
    const canBreakthrough = percent >= 60;

    // 计算突破类型
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

  // 处理闭关年限输入
  const handleRetreatYearsChange = useCallback((value: string) => {
    const numeric = value.replace(/[^\d]/g, '');
    setRetreatYears(numeric);
  }, []);

  // 闭关修炼
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

    setRetreatLoading(true);
    try {
      const response = await fetch('/api/cultivator/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          years: parsedYears,
          action: 'cultivate',
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '闭关失败');
      }

      setRetreatResult(payload.data);
      await refresh();
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '闭关失败，请稍后再试',
        tone: 'danger',
      });
    } finally {
      setRetreatLoading(false);
    }
  }, [cultivator, retreatYears, pushToast, refresh]);

  // 点击突破按钮
  const handleBreakthroughClick = useCallback(() => {
    setShowBreakthroughConfirm(true);
  }, []);

  // 关闭突破确认弹窗
  const closeBreakthroughConfirm = useCallback(() => {
    setShowBreakthroughConfirm(false);
  }, []);

  // 执行突破
  const handleBreakthrough = useCallback(async () => {
    if (!cultivator) return;

    setShowBreakthroughConfirm(false);
    setRetreatLoading(true);

    try {
      const response = await fetch('/api/cultivator/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          action: 'breakthrough',
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '突破失败');
      }

      setRetreatResult(payload.data);
      await refresh();
    } catch (error) {
      pushToast({
        message:
          error instanceof Error ? error.message : '突破失败，请稍后再试',
        tone: 'danger',
      });
    } finally {
      setRetreatLoading(false);
    }
  }, [cultivator, pushToast, refresh]);

  // 前往转世
  const handleGoReincarnate = useCallback(() => {
    if (retreatResult?.story && typeof window !== 'undefined' && cultivator) {
      window.sessionStorage.setItem(
        'reincarnateContext',
        JSON.stringify({
          story: retreatResult.story,
          name: cultivator.name,
          realm: cultivator.realm,
          realm_stage: cultivator.realm_stage,
        }),
      );
    }
    router.push('/reincarnate');
  }, [retreatResult, cultivator, router]);

  // 清除结果
  const clearRetreatResult = useCallback(() => {
    setRetreatResult(null);
  }, []);

  return {
    // 数据
    cultivator,
    isLoading,
    note,
    remainingLifespan,
    cultivationProgress,

    // 表单状态
    retreatYears,
    setRetreatYears,
    handleRetreatYearsChange,

    // 操作状态
    retreatLoading,
    retreatResult,
    showBreakthroughConfirm,

    // 业务操作
    handleRetreat,
    handleBreakthroughClick,
    handleBreakthrough,
    closeBreakthroughConfirm,
    handleGoReincarnate,
    clearRetreatResult,
  };
}
