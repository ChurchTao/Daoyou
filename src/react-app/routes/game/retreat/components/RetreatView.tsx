import { useLifespanStatus } from '@app/components/feature/cultivator/LifespanStatusCard';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
} from '@app/components/game-shell';
import { InkBadge, InkButton, InkInput, InkNotice } from '@app/components/ui';

import { useRetreatViewModel } from '../hooks/useRetreatViewModel';
import { BreakthroughConfirmModal } from './BreakthroughConfirmModal';
import { RetreatResultSection } from './RetreatResultSection';

function formatChance(value: number | undefined) {
  if (typeof value !== 'number') return '未明';
  return `${Math.round(value * 1000) / 10}%`;
}

function BreakthroughLabel({
  type,
}: {
  type: 'forced' | 'normal' | 'perfect' | null;
}) {
  if (!type) return null;

  const tone =
    type === 'perfect' ? '金丹' : type === 'normal' ? '筑基' : '炼气';
  const text =
    type === 'perfect'
      ? '圆满突破'
      : type === 'normal'
        ? '常规突破'
        : '强行突破';

  return <InkBadge tier={tone}>{text}</InkBadge>;
}

function QuietRoomMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border-ink/15 bg-bgpaper border border-dashed px-3 py-3">
      <div className="text-battle-muted text-[0.68rem] tracking-[0.18em]">
        {label}
      </div>
      <div className="text-ink mt-2 text-lg">{value}</div>
      <div className="text-ink-secondary mt-1 text-xs leading-5">{hint}</div>
    </div>
  );
}

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
  const { status: lifespanStatus } = useLifespanStatus({
    cultivatorId: cultivator?.id ?? '',
    autoRefresh: true,
    refreshInterval: 60_000,
  });

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">洞府封闭中，稍候片刻……</p>
      </div>
    );
  }

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
      title="静室修行"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="静室案头">
            <div className="space-y-2 text-sm leading-7">
              <p>当前境界：{cultivator.realm_stage}</p>
              <p>剩余寿元：{remainingLifespan} 年</p>
              <p>累计闭关：{cultivator.closed_door_years_total ?? 0} 年</p>
              <p>本次闭关：{retreatYears || '未定'} 年</p>
            </div>
          </GameSceneAsideSection>

          <GameSceneAsideSection title="寿元账">
            <div className="space-y-2 text-sm leading-7">
              {lifespanStatus ? (
                <>
                  <p>
                    今日已用：{lifespanStatus.consumed}/
                    {lifespanStatus.dailyLimit} 年
                  </p>
                  <p>今日尚余：{lifespanStatus.remaining} 年</p>
                </>
              ) : (
                <p>寿元账册尚在整理。</p>
              )}
              <p className="text-ink-secondary">
                闭关愈久，修为增长愈多，但寿元也会一并消耗。
              </p>
            </div>
          </GameSceneAsideSection>

          <GameSceneAsideSection title="冲关火候">
            <div className="space-y-2 text-sm leading-7">
              <p>修为约：{cultivationProgress?.percent ?? 0}%</p>
              <p>
                道心感悟：{cultivationProgress?.comprehension_insight ?? 0}/100
              </p>
              <p>成功把握：{formatChance(breakthroughPreview?.finalChance)}</p>
              {breakthroughPreview?.recommendation ? (
                <p className="text-ink-secondary">
                  {breakthroughPreview.recommendation}
                </p>
              ) : (
                <p className="text-ink-secondary">
                  修为达 60% 可试冲关，圆满火候更宜稳破。
                </p>
              )}
            </div>
          </GameSceneAsideSection>
        </>
      }
    >
      <GameSceneSection title="当前火候">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuietRoomMetric
            label="境界"
            value={cultivator.realm_stage}
            hint="静室中一切筹算都以当前境界为基。"
          />
          <QuietRoomMetric
            label="修为"
            value={`${cultivationProgress?.percent ?? 0}%`}
            hint="修为达到 60% 后，才有资格尝试突破。"
          />
          <QuietRoomMetric
            label="感悟"
            value={`${cultivationProgress?.comprehension_insight ?? 0}/100`}
            hint="感悟越高，冲关时越稳。"
          />
          <QuietRoomMetric
            label="突破"
            value={formatChance(breakthroughPreview?.finalChance)}
            hint="结合修为、感悟与当前状态得出的估计。"
          />
        </div>

        <div className="border-battle-rule-strong mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3 text-sm">
          <span className="text-ink-secondary">当前判断：</span>
          <BreakthroughLabel
            type={cultivationProgress?.breakthroughType ?? null}
          />
          {!cultivationProgress?.canBreakthrough ? (
            <span className="text-battle-muted">
              修为未到 60%，仍应以闭关积累为先。
            </span>
          ) : null}
        </div>
      </GameSceneSection>

      <GameSceneSection title="本次闭关">
        <div className="space-y-4 text-sm leading-7">
          <p>
            静室只看与这一次决断直接相关的事：要押几年寿元、此刻该不该冲关，以及冲关失败后还能否承受代价。
          </p>

          <InkInput
            label="闭关年限"
            value={retreatYears}
            placeholder="输入 1~200 之间的整数"
            onChange={handleRetreatYearsChange}
            hint="闭关越久修为增长越多，也会消耗相应寿元。"
          />

          <div className="flex flex-wrap gap-2">
            <InkButton
              onClick={handleRetreat}
              disabled={retreatLoading}
              variant="primary"
            >
              {retreatLoading ? '修炼中……' : '闭关修炼'}
            </InkButton>

            {cultivationProgress?.canBreakthrough ? (
              <InkButton
                onClick={handleBreakthroughClick}
                disabled={retreatLoading}
              >
                {retreatLoading ? '冲关中……' : '尝试突破'}
              </InkButton>
            ) : null}
          </div>
        </div>
      </GameSceneSection>

      <BreakthroughConfirmModal
        isOpen={showBreakthroughConfirm}
        onClose={closeBreakthroughConfirm}
        onConfirm={handleBreakthrough}
        chancePreview={breakthroughPreview}
      />

      {retreatResult ? (
        <RetreatResultSection
          retreatResult={retreatResult}
          onGoReincarnate={handleGoReincarnate}
        />
      ) : null}
    </GameSceneFrame>
  );
}
