'use client';

import { CultivatorStatusCard } from '@/components/feature/cultivator/CultivatorStatusCard';
import { InkPageShell, InkSection } from '@/components/layout';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkInput,
  InkNotice,
} from '@/components/ui';
import { usePathname } from 'next/navigation';

import { useRetreatViewModel } from '../hooks/useRetreatViewModel';
import { BreakthroughConfirmModal } from './BreakthroughConfirmModal';
import { RetreatResultSection } from './RetreatResultSection';

/**
 * 洞府主视图组件
 */
export function RetreatView() {
  const pathname = usePathname();
  const {
    cultivator,
    isLoading,
    note,
    remainingLifespan,
    cultivationProgress,
    breakthroughPreview,
    retreatYears,
    handleRetreatYearsChange,
    retreatLoading,
    retreatResult,
    showBreakthroughConfirm,
    handleRetreat,
    handleBreakthroughClick,
    handleBreakthrough,
    closeBreakthroughConfirm,
    handleGoReincarnate,
  } = useRetreatViewModel();

  // 加载状态
  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">洞府封闭中，稍候片刻……</p>
      </div>
    );
  }

  // 未创建角色
  if (!cultivator) {
    return (
      <InkPageShell
        title="【洞府】"
        subtitle="须有道基，方可入定"
        backHref="/game"
        currentPath={pathname}
      >
        <InkNotice>
          尚未觉醒灵根，无法入驻洞府。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            前往觉醒 →
          </InkButton>
        </InkNotice>
      </InkPageShell>
    );
  }

  return (
    <InkPageShell
      title="【洞府】"
      subtitle="莫负洞天一寸时"
      backHref="/game"
      currentPath={pathname}
      note={note}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【悟道修行】">
        <div className="space-y-3 text-sm leading-6">
          {/* 当前状态概览 */}
          <div className="border-ink/20 bg-ink/5 rounded-lg border p-3 shadow-sm">
            <p className="text-ink-secondary mb-2">
              当前境界：
              <InkBadge tier={cultivator.realm}>
                {cultivator.realm_stage}
              </InkBadge>
            </p>
            <p className="text-ink-secondary">
              剩余寿元：
              <span className="text-ink font-bold">{remainingLifespan}</span> 年
              <span className="ml-4 opacity-60">
                累计闭关 {cultivator.closed_door_years_total ?? 0} 年
              </span>
            </p>
          </div>

          {/* 修为状态卡片 */}
          {cultivator.cultivation_progress && (
            <CultivatorStatusCard cultivator={cultivator} showDetails={true} />
          )}

          {/* 闭关年限输入 */}
          <InkInput
            label="闭关年限"
            value={retreatYears}
            placeholder="输入 1~200 之间的整数"
            onChange={handleRetreatYearsChange}
            hint="闭关越久修为增长越多，但会消耗相应寿元"
          />

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <InkButton
              onClick={handleRetreat}
              disabled={retreatLoading}
              className="flex-1"
            >
              {retreatLoading ? '修炼中……' : '🧘 闭关修炼'}
            </InkButton>

            {cultivationProgress?.canBreakthrough && (
              <InkButton
                onClick={handleBreakthroughClick}
                disabled={retreatLoading}
                variant="primary"
                className="flex-1"
              >
                {retreatLoading ? '冲关中……' : '⚡️ 尝试突破'}
              </InkButton>
            )}
          </div>

          {/* 提示 */}
          {!cultivationProgress?.canBreakthrough && (
            <p className="text-sm opacity-70">提示：修为达到60%时可尝试突破</p>
          )}
        </div>
      </InkSection>

      {/* 突破确认弹窗 */}
      <BreakthroughConfirmModal
        isOpen={showBreakthroughConfirm}
        onClose={closeBreakthroughConfirm}
        onConfirm={handleBreakthrough}
        chancePreview={breakthroughPreview}
      />

      {/* 修炼/突破结果 */}
      {retreatResult && (
        <RetreatResultSection
          retreatResult={retreatResult}
          onGoReincarnate={handleGoReincarnate}
        />
      )}
    </InkPageShell>
  );
}
