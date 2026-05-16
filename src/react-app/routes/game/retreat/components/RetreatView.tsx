import { CultivatorStatusCard } from '@app/components/feature/cultivator/CultivatorStatusCard';
import { GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import {
  InkActionGroup, InkBadge, InkButton, InkInput, InkNotice, } from '@app/components/ui';

import { useRetreatViewModel } from '../hooks/useRetreatViewModel';
import { BreakthroughConfirmModal } from './BreakthroughConfirmModal';
import { RetreatResultSection } from './RetreatResultSection';


/**
 * 洞府主视图组件
 */
export function RetreatView() {
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
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">洞府封闭中，稍候片刻……</p>
      </div>
    );
  }

  // 未创建角色
  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚未觉醒灵根，无法入驻洞府。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            前往觉醒 →
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  return (
    <GameSceneFrame
      eyebrow="修炼焦点"
      title="【洞府修行】"
      description="收束外务，静室观息。闭关、悟道与冲关都在此完成，最该关注的是寿元余量、瓶颈状态与这一次要押上的年数。"
      headerMeta={
        note ? (
          <div className="battle-note">
            <p className="text-sm leading-7">{note}</p>
          </div>
        ) : undefined
      }
      aside={
        <>
          <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
            <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
              修行摘要
            </div>
            <div className="space-y-2 text-sm leading-7">
              <p>当前境界：{cultivator.realm_stage}</p>
              <p>剩余寿元：{remainingLifespan} 年</p>
              <p>累计闭关：{cultivator.closed_door_years_total ?? 0} 年</p>
              <p>本次闭关：{retreatYears || '未定'} 年</p>
            </div>
          </section>
          <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4 text-sm leading-7">
            <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
              关窍提醒
            </div>
            <p>修为达 60% 可尝试突破，达 100% 且感悟足够时更稳。</p>
            <p className="mt-2">若见瓶颈久驻，宜转去历练、斗法或参悟求感悟。</p>
          </section>
        </>
      }
      actionBar={
        <InkActionGroup align="between">
          <InkButton href="/game">返回</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="【悟道修行】">
        <div className="space-y-3 text-sm leading-6">
          {/* 当前状态概览 */}
          <div className="border-ink/30 bg-bgpaper border p-3 border-dashed">
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
    </GameSceneFrame>
  );
}
