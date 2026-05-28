import { useLifespanStatus } from '@app/components/feature/cultivator/LifespanStatusCard';
import {
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge, InkButton, InkInput, InkNotice } from '@app/components/ui';

import { useRetreatViewModel } from '../hooks/useRetreatViewModel';
import { BreakthroughConfirmModal } from './BreakthroughConfirmModal';
import { RetreatResultModal } from './RetreatResultModal';

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

function getBreakthroughTypeText(type: 'forced' | 'normal' | 'perfect' | null) {
  if (type === 'perfect') return '圆满突破';
  if (type === 'normal') return '常规突破';
  if (type === 'forced') return '强行突破';
  return null;
}

export function BreakthroughHelpContent({
  breakthroughType,
  canBreakthrough,
  isMajorBreakthrough,
  majorBreakthroughBlocked,
}: {
  breakthroughType: 'forced' | 'normal' | 'perfect' | null;
  canBreakthrough: boolean;
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
}) {
  const currentTypeText = getBreakthroughTypeText(breakthroughType);

  return (
    <div className="space-y-4 text-sm leading-7">
      <p className="text-ink-secondary">
        {!canBreakthrough
          ? '你当前修为尚未到 60%，还不能正式尝试突破。此时静室更适合继续闭关积累。'
          : isMajorBreakthrough && majorBreakthroughBlocked
            ? `你当前的火候已摸到「${currentTypeText ?? '突破'}」，但这是跨大境界冲关，仍需先补齐破境前置。`
            : currentTypeText
              ? `你当前的眼下火候是「${currentTypeText}」。若决定冲关，确认时再看那一刻的成败推演。`
              : '突破火候会随着修为与感悟变化，决定你此刻适合怎样起手。'}
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-ink font-medium">强行突破</p>
          <p className="text-ink-secondary">
            修为达到 60%
            后即可尝试。此时只是勉强摸到门槛，适合在寿元紧迫或不得不赌一把时起手，风险最高。
          </p>
        </div>

        <div>
          <p className="text-ink font-medium">常规突破</p>
          <p className="text-ink-secondary">
            修为达到 80%
            后即可尝试。根基比强行突破更稳，通常是大多数修士会考虑出手的火候。
          </p>
        </div>

        <div>
          <p className="text-ink font-medium">圆满突破</p>
          <p className="text-ink-secondary">
            修为达到 100%，且道心感悟至少达到 50
            时方可成形。此时火候最足，往往是最稳妥的破关时机。
          </p>
        </div>
      </div>

      <p className="text-ink-secondary">
        无论哪一种火候，真正的成功率与失败代价都以确认时的推演为准。
        {isMajorBreakthrough
          ? '若是跨大境界突破，还需先完成当前破境卷宗，静室才会放开正式冲关。'
          : ''}
      </p>
    </div>
  );
}

function RetreatSummaryEntry({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-battle-muted text-[0.72rem] tracking-[0.18em]">
        {label}
      </dt>
      <dd className="text-ink mt-1 text-base leading-7">{value}</dd>
      <div className="text-ink-secondary mt-1 text-xs leading-6">{note}</div>
    </div>
  );
}

function getRetreatLeadText({
  isMajorBreakthrough,
  majorBreakthroughBlocked,
}: {
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
}) {
  if (isMajorBreakthrough && majorBreakthroughBlocked) {
    return '石门一合，静室里只余炉火与回声。这一关还不到起手的时候，你更该先把破境前置补齐，再决定要不要拿寿元去换这一回闭关。';
  }

  if (isMajorBreakthrough) {
    return '炉火已稳，卷宗也已齐备。静室此刻只剩一个问题：你准备押下多少寿元，再决定要不要在这一炷香里冲开下一重天门。';
  }

  return '蒲团、丹炉与静香都已备好。你只需定下这次要坐多少年，再看眼前火候，是继续积累，还是顺势推门试上一关。';
}

function getRetreatGuidanceText({
  canBreakthrough,
  isMajorBreakthrough,
  majorBreakthroughBlocked,
  tasksLoading,
  currentMajorTaskTitle,
  breakthroughRecommendation,
}: {
  canBreakthrough: boolean;
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
  tasksLoading: boolean;
  currentMajorTaskTitle?: string;
  breakthroughRecommendation?: string;
}) {
  if (isMajorBreakthrough && majorBreakthroughBlocked) {
    if (tasksLoading) {
      return '破境卷宗仍在整理，静室暂且只适合继续闭关。';
    }

    if (currentMajorTaskTitle) {
      return `${currentMajorTaskTitle} 尚未办妥，正式冲关还得再等等。`;
    }

    return '大境界门槛已至，但卷宗尚未归档完成。';
  }

  if (!canBreakthrough) {
    return '修为未到门槛，先把这回闭关坐实。';
  }

  return breakthroughRecommendation ?? '火候已到，是否冲关，只看你此刻心意。';
}

export function RetreatView() {
  const { openDialog } = useInkUI();
  const {
    cultivator,
    isLoading,
    note,
    remainingLifespan,
    cultivationProgress,
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
  } = useRetreatViewModel();
  const { status: lifespanStatus } = useLifespanStatus({
    cultivatorId: cultivator?.id ?? '',
    autoRefresh: true,
    refreshInterval: 60_000,
  });
  const shouldHoldResultShell =
    !cultivator && retreatResultOpen && Boolean(retreatResult?.depleted);

  if (isLoading && !cultivator && !shouldHoldResultShell) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">洞府封闭中，稍候片刻……</p>
      </div>
    );
  }

  if (!cultivator) {
    if (shouldHoldResultShell) {
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
        >
          <GameSceneSection>
            <div className="border-ink/10 bg-bgpaper/70 border border-dashed px-4 py-4 text-sm leading-7">
              前尘回响尚未收束，听完这一段，再踏入轮回。
            </div>
          </GameSceneSection>

          <RetreatResultModal
            isOpen={retreatResultOpen}
            retreatResult={retreatResult}
            isStreaming={retreatResultStreaming}
            celebrationTick={celebrationTick}
            onClose={closeRetreatResult}
            onGoReincarnate={handleGoReincarnate}
          />
        </GameSceneFrame>
      );
    }

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

  const canAttemptBreakthrough =
    Boolean(cultivationProgress?.canBreakthrough) &&
    (!isMajorBreakthrough || !majorBreakthroughBlocked);
  const guidanceText = getRetreatGuidanceText({
    canBreakthrough: Boolean(cultivationProgress?.canBreakthrough),
    isMajorBreakthrough,
    majorBreakthroughBlocked,
    tasksLoading,
    currentMajorTaskTitle: currentMajorTask?.snapshot.title,
    breakthroughRecommendation: breakthroughPreview?.recommendation,
  });
  const missingRequirements =
    currentMajorTask?.snapshot.missingRequirements.slice(0, 2) ?? [];
  const openBreakthroughHelp = () => {
    openDialog({
      title: '突破火候说明',
      content: (
        <BreakthroughHelpContent
          breakthroughType={cultivationProgress?.breakthroughType ?? null}
          canBreakthrough={Boolean(cultivationProgress?.canBreakthrough)}
          isMajorBreakthrough={isMajorBreakthrough}
          majorBreakthroughBlocked={majorBreakthroughBlocked}
        />
      ),
      confirmLabel: '知晓了',
      cancelLabel: null,
    });
  };

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
    >
      <GameSceneSection>
        <div className="border-ink/10 bg-bgpaper/70 space-y-5 border border-dashed px-4 py-4 md:px-5">
          <div className="space-y-3 text-sm leading-7">
            <p>
              {getRetreatLeadText({
                isMajorBreakthrough,
                majorBreakthroughBlocked,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm leading-7">
              <span className="text-ink-secondary">眼下火候：</span>
              {cultivationProgress?.canBreakthrough ? (
                <BreakthroughLabel
                  type={cultivationProgress.breakthroughType ?? null}
                />
              ) : null}
              <span className="text-ink-secondary">{guidanceText}</span>
              <InkButton onClick={openBreakthroughHelp} variant="ghost">
                查看说明
              </InkButton>
            </div>
          </div>

          {isMajorBreakthrough ? (
            tasksLoading ? (
              <p className="text-ink-secondary text-sm leading-7">
                破境卷宗整理中……稍后便会显出这一关还缺什么。
              </p>
            ) : taskError ? (
              <InkNotice>{taskError}</InkNotice>
            ) : majorBreakthroughBlocked && currentMajorTask ? (
              <div className="border-ink/10 space-y-3 border border-dashed bg-[rgba(255,252,245,0.74)] px-4 py-3">
                <div className="space-y-1">
                  <p className="text-ink text-sm font-medium">
                    {currentMajorTask.snapshot.title}
                  </p>
                  <p className="text-ink-secondary text-sm leading-7">
                    {currentMajorTask.snapshot.summary}
                  </p>
                </div>

                {missingRequirements.length > 0 ? (
                  <ul className="text-ink-secondary space-y-1 text-sm leading-7">
                    {missingRequirements.map((requirement) => (
                      <li key={requirement}>• {requirement}</li>
                    ))}
                  </ul>
                ) : null}

                {currentMajorTask.snapshot.missingRequirements.length >
                missingRequirements.length ? (
                  <p className="text-ink-secondary text-xs leading-6">
                    其余细项已归回卷宗，不在静室逐条摊开。
                  </p>
                ) : null}
              </div>
            ) : majorBreakthroughBlocked ? (
              <p className="text-ink-secondary text-sm leading-7">
                当前已临大境界门槛，但卷宗尚未归档完成。稍后刷新即可继续。
              </p>
            ) : null
          ) : null}

          <div className="space-y-3">
            <InkInput
              label="闭关年限"
              value={retreatYears}
              placeholder="输入 1~200 之间的整数"
              onChange={handleRetreatYearsChange}
              hint={
                lifespanStatus
                  ? `闭关越久，修为增长越多。今日尚余 ${lifespanStatus.remaining} 年寿元可用，已用 ${lifespanStatus.consumed}/${lifespanStatus.dailyLimit} 年。`
                  : '闭关越久，修为增长越多。寿元账册尚在整理，先按心中的年限定下这次闭关。'
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <InkButton
              onClick={handleRetreat}
              disabled={retreatLoading}
              variant="primary"
            >
              {retreatLoading ? '修炼中……' : '闭关修炼'}
            </InkButton>

            {canAttemptBreakthrough ? (
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

      <GameSceneSection title="当前筹算">
        <div className="border-ink/10 bg-bgpaper/60 border border-dashed px-4 py-4">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <RetreatSummaryEntry
              label="当前境界"
              value={`${cultivator.realm}${cultivator.realm_stage}`}
              note="静室里的一切筹算，都从这一层火候起算。"
            />
            <RetreatSummaryEntry
              label="修为进度"
              value={`${cultivationProgress?.percent ?? 0}%`}
              note="修为达到 60% 后，才算摸到冲关门槛。"
            />
            <RetreatSummaryEntry
              label="道心感悟"
              value={`${cultivationProgress?.comprehension_insight ?? 0}/100`}
              note="感悟越稳，临门一脚越不容易乱。"
            />
            <RetreatSummaryEntry
              label="剩余寿元"
              value={`${remainingLifespan} 年`}
              note="这次要坐多久、还能承受几次尝试，都看它。"
            />
          </dl>
        </div>
      </GameSceneSection>

      <BreakthroughConfirmModal
        isOpen={showBreakthroughConfirm}
        onClose={closeBreakthroughConfirm}
        onConfirm={handleBreakthrough}
        chancePreview={breakthroughPreview}
        isMajorBreakthrough={isMajorBreakthrough}
      />

      <RetreatResultModal
        isOpen={retreatResultOpen}
        retreatResult={retreatResult}
        isStreaming={retreatResultStreaming}
        celebrationTick={celebrationTick}
        onClose={closeRetreatResult}
        onGoReincarnate={handleGoReincarnate}
      />
    </GameSceneFrame>
  );
}
