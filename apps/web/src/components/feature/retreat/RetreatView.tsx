import { PillQuickbar } from '@app/components/feature/items/PillQuickbar';
import { BreakthroughTaskCard } from '@app/components/feature/tasks/BreakthroughTaskCard';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
  GameSceneSection,
  GameSceneTabs,
} from '@app/components/game-shell';
import { GameSceneHelpButton } from '@app/components/game-shell/GameSceneSection';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkNodeSlider } from '@app/components/ui/InkNodeSlider';
import { getBreakthroughNextStep } from '@app/lib/tasks/taskClient';
import {
  BOTTLENECK_EXP_PENALTY,
  BOTTLENECK_THRESHOLD,
  BREAKTHROUGH_MIN_PROGRESS,
  NORMAL_BREAKTHROUGH_THRESHOLD,
  PERFECT_BREAKTHROUGH_INSIGHT,
} from '@daoyou/game-content/cultivation';
import { getGameConceptLabel } from '@daoyou/game-content/presentation/concepts';
import { QI_ACTION_COSTS } from '@daoyou/game-content/qi/config';
import { getNextMajorRealm } from '@daoyou/game-rules/consumables/breakthrough';
import { getNextStage } from '@daoyou/game-rules/cultivation';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BreakthroughConfirmModal } from './BreakthroughConfirmModal';
import type { RetreatBuffTag } from './retreatEfficiency';
import { RetreatResultModal } from './RetreatResultModal';
import { isSuccessfulBreakthrough } from './retreatStream';
import {
  useRetreatViewModel,
  type BreakthroughChancePreviewData,
  type CultivationProgressData,
} from './useRetreatViewModel';

const COMPREHENSION_LABEL = getGameConceptLabel('comprehension_insight');
const RETREAT_YEARS = [10, 20, 50, 100, 200] as const;
const BREAKTHROUGH_TYPES = {
  forced: { label: '强行突破', color: 'text-crimson' },
  normal: { label: '常规突破', color: 'text-teal' },
  perfect: { label: '圆满突破', color: 'text-amber-700' },
};
const BOTTLENECK_REDUCTION = (1 - BOTTLENECK_EXP_PENALTY) * 100;

function getBreakthroughTypeText(type: 'forced' | 'normal' | 'perfect' | null) {
  return type ? BREAKTHROUGH_TYPES[type].label : null;
}

function BottleneckHelpContent() {
  return (
    <div className="space-y-2 text-sm leading-7">
      <p>
        修为达到当前阶段上限的{' '}
        <span className="font-mono">{BOTTLENECK_THRESHOLD}%</span>{' '}
        时，道基渐满，进入瓶颈。
      </p>
      <p>
        瓶颈期间，闭关获得的修为降低{' '}
        <span className="font-mono">{BOTTLENECK_REDUCTION}%</span>
        ，感悟收益不受这项衰减影响。继续闭关仍可积累，也可通过历练积累修为与感悟，准备突破。
      </p>
      <p>
        瓶颈随当前修为判断；突破进入下一阶段，或修为降至门槛以下后，便不再受这项衰减影响。
      </p>
    </div>
  );
}

function RetreatProgress({
  progress,
  bottleneckActive,
}: {
  progress: CultivationProgressData | null;
  bottleneckActive: boolean;
}) {
  if (!progress) return null;
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span>修为</span>
        <span className="text-ink-secondary font-mono text-xs">
          {progress.cultivation_exp.toLocaleString('zh-CN')} /{' '}
          {progress.exp_cap.toLocaleString('zh-CN')}
        </span>
        <span className="font-mono">{progress.percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="修为进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, progress.percent)}
        className="bg-ink/10 h-0.5"
      >
        <div
          className="bg-teal h-full"
          style={{ width: `${Math.min(100, progress.percent)}%` }}
        />
      </div>
      {bottleneckActive ? (
        <div className="text-wood flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-6">
          <span className="inline-flex items-center gap-1.5">
            <GameIcon value="⛰️" />
            <span>
              瓶颈 · 闭关修为收益降低{' '}
              <span className="font-mono">{BOTTLENECK_REDUCTION}%</span>
            </span>
          </span>
          <GameSceneHelpButton
            help={{
              title: '什么是瓶颈',
              label: '为何',
              content: <BottleneckHelpContent />,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function RetreatHelpContent() {
  return (
    <div className="space-y-4 text-sm leading-7">
      <p>
        闭关积累修为与感悟。选择年限后入定，将消耗所选年限的寿元，并耗费天地灵气，具体消耗在确认时核对。
      </p>
      <BottleneckHelpContent />
      <p>
        养元药力可提高闭关修为收益；已生效的助益显示在修为进度下方，可从随身丹药栏查看药效并服用。
      </p>
    </div>
  );
}

function BreakthroughReadiness({
  progress,
}: {
  progress: CultivationProgressData | null;
}) {
  if (!progress) return null;
  const type =
    progress.breakthroughType && BREAKTHROUGH_TYPES[progress.breakthroughType];
  return (
    <div className="space-y-2" aria-live="polite">
      <p
        className={`text-lg font-medium ${type ? type.color : 'text-ink-secondary'}`}
      >
        {type ? type.label : '火候未至'}
      </p>
      <p className="text-ink-secondary flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6">
        <span>
          修为 <span className="font-mono">{progress.percent}%</span>
        </span>
        <span>
          {COMPREHENSION_LABEL}{' '}
          <span className="font-mono">{progress.comprehension_insight}</span>
        </span>
      </p>
    </div>
  );
}

function BreakthroughWarnings({
  preview,
}: {
  preview: BreakthroughChancePreviewData | null;
}) {
  const risks =
    preview?.factors.filter(
      (factor) => factor.key === 'inner-demon' || factor.key === 'toxicity',
    ) ?? [];
  if (!risks.length) return null;
  return (
    <div
      aria-label="冲关隐患"
      className="text-crimson space-y-1 text-xs leading-6"
    >
      {risks.map((risk) => (
        <p key={risk.key} className="flex items-center gap-1.5">
          <GameIcon value={risk.key === 'inner-demon' ? '👁️' : '☠️'} />
          <span>
            {risk.key === 'inner-demon'
              ? '心魔扰动，突破成功率降低。'
              : '丹毒未散，突破成功率降低。'}
          </span>
        </p>
      ))}
    </div>
  );
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
              ? `当前火候为「${currentTypeText}」。确认冲关时可查看成功率与风险。`
              : '突破火候会随着修为与感悟变化，决定你此刻适合怎样起手。'}
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-crimson font-medium">强行突破</p>
          <p className="text-ink-secondary">
            修为达到 {BREAKTHROUGH_MIN_PROGRESS}%
            后即可尝试。此时只是勉强摸到门槛，适合在寿元紧迫或不得不赌一把时起手，风险最高。
          </p>
        </div>

        <div>
          <p className="text-teal font-medium">常规突破</p>
          <p className="text-ink-secondary">
            修为达到 {NORMAL_BREAKTHROUGH_THRESHOLD}%
            后即可尝试。根基比强行突破更稳，通常是大多数修士会考虑出手的火候。
          </p>
        </div>

        <div>
          <p className="font-medium text-amber-700">圆满突破</p>
          <p className="text-ink-secondary">
            修为达到 100%，且{COMPREHENSION_LABEL}至少达到{' '}
            {PERFECT_BREAKTHROUGH_INSIGHT}
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

function ActiveMedicine({ tags }: { tags: RetreatBuffTag[] }) {
  if (!tags.length) return null;
  return (
    <div
      aria-label="当前修行助益"
      aria-live="polite"
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6"
    >
      {tags.map((tag) => (
        <span
          key={tag.key}
          className={`inline-flex items-center gap-1.5 ${tag.tone === 'warning' ? 'text-wood' : 'text-teal'}`}
        >
          <GameIcon value={tag.icon} />
          <span>{tag.label}</span>
          <span className="font-mono">{tag.value}</span>
        </span>
      ))}
    </div>
  );
}

export type RetreatViewProps = {
  sectContext?: {
    facilityLevel: number;
    experienceBonusPercent: number;
    facilityLabel: string;
    scene: import('@daoyou/game-rules/sect-organization').SectScenePresentation;
    onExit?(): void;
  };
};

export function RetreatView({ sectContext }: RetreatViewProps) {
  const [activeTab, setActiveTab] = useState<'retreat' | 'breakthrough'>(
    'retreat',
  );
  const [appliedGate, setAppliedGate] = useState<string | null>(null);
  const [pillPending, setPillPending] = useState(false);
  const navigate = useNavigate();
  const {
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
    reloadTasks,
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
  const majorGateKey =
    retreatResult && isSuccessfulBreakthrough(retreatResult)
      ? 'toStage' in retreatResult.summary &&
        retreatResult.summary.toStage === '圆满' &&
        retreatResult.summary.toRealm &&
        getNextMajorRealm(retreatResult.summary.toRealm)
        ? `${retreatResult.summary.fromRealm}${retreatResult.summary.fromStage}-${retreatResult.summary.toRealm}`
        : null
      : null;
  if (majorGateKey !== appliedGate) {
    setAppliedGate(majorGateKey);
    if (majorGateKey) setActiveTab('breakthrough');
  }
  const shouldHoldResultShell =
    !cultivator && retreatResultOpen && Boolean(retreatResult?.depleted);
  const headerMeta =
    sectContext || note ? (
      <div className="space-y-3">
        {sectContext ? (
          <InkButton
            onClick={() =>
              sectContext.onExit ? sectContext.onExit() : navigate('/game/sect')
            }
            variant="secondary"
          >
            返回守阵执事
          </InkButton>
        ) : null}
        {note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : null}
      </div>
    ) : undefined;

  if (isLoading && !cultivator && !shouldHoldResultShell) {
    return <GameSceneLoading message="洞府封闭中，稍候片刻……" />;
  }

  if (!cultivator) {
    if (shouldHoldResultShell) {
      return (
        <GameSceneFrame
          title={sectContext ? sectContext.scene.title : '静室修行'}
          identityOverride={
            sectContext
              ? {
                  label: sectContext.scene.title,
                  summary: sectContext.scene.description,
                }
              : undefined
          }
          headerMeta={headerMeta}
        >
          <GameSceneSection>
            <div className="border-ink/10 bg-paper-2 border border-dashed px-4 py-4 text-sm leading-7">
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
            allowAttributeNavigation={!sectContext}
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

  const nextStage = getNextStage(cultivator.realm, cultivator.realm_stage);
  const canAttemptBreakthrough =
    Boolean(nextStage) &&
    Boolean(cultivationProgress?.canBreakthrough) &&
    (!isMajorBreakthrough || !majorBreakthroughBlocked);
  const years = Number(retreatYears);
  const unavailable = retreatLoading || pillPending;
  const guidance =
    tasksLoading && isMajorBreakthrough
      ? '正在核对破境准备……'
      : majorBreakthroughBlocked
        ? currentMajorTask
          ? getBreakthroughNextStep(currentMajorTask)
          : '正在等候破境卷宗，重新核对后即可查看准备。'
        : !nextStage
          ? '道途已至此境之巅。'
          : !cultivationProgress?.canBreakthrough
            ? '火候尚浅，先静修积累。'
            : breakthroughPreview && breakthroughPreview.finalChance < 0.5
              ? '此刻冲关把握尚低，可先静修或借丹药调息。'
              : '气息渐稳，可凝神尝试冲关。';

  return (
    <GameSceneFrame
      title={sectContext?.scene.title}
      identityOverride={
        sectContext
          ? {
              label: sectContext.scene.title,
              summary: sectContext.scene.description,
            }
          : undefined
      }
      headerMeta={headerMeta}
    >
      <div className="flex items-start justify-between gap-4">
        <GameSceneTabs
          items={[
            { label: '闭关', value: 'retreat' },
            { label: '突破', value: 'breakthrough' },
          ]}
          activeValue={activeTab}
          onChange={(value) =>
            setActiveTab(value as 'retreat' | 'breakthrough')
          }
        />
        <GameSceneHelpButton
          help={{
            label: activeTab === 'retreat' ? '闭关须知' : '突破须知',
            title: activeTab === 'retreat' ? '闭关修炼说明' : '突破火候说明',
            content:
              activeTab === 'retreat' ? (
                <RetreatHelpContent />
              ) : (
                <BreakthroughHelpContent
                  breakthroughType={
                    cultivationProgress?.breakthroughType ?? null
                  }
                  canBreakthrough={Boolean(
                    cultivationProgress?.canBreakthrough,
                  )}
                  isMajorBreakthrough={isMajorBreakthrough}
                  majorBreakthroughBlocked={majorBreakthroughBlocked}
                />
              ),
          }}
        />
      </div>

      <div className="grid min-w-0 items-center gap-3 py-2 sm:min-h-[22rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:gap-8 sm:py-5">
        <div className="flex justify-center" aria-hidden="true">
          <img
            src={`/assets/manuals/cultivator-${cultivator.gender === '女' ? 'female' : 'male'}-meditation.webp`}
            alt=""
            className="h-20 w-auto max-w-full object-contain sm:h-64 lg:h-72"
          />
        </div>
        <div className="min-w-0 space-y-2 sm:space-y-5 sm:pr-4 lg:pr-8">
          {activeTab === 'retreat' ? (
            <>
              <RetreatProgress
                progress={cultivationProgress}
                bottleneckActive={Boolean(retreatEfficiency?.bottleneckActive)}
              />
              <ActiveMedicine tags={retreatEfficiency?.retreatTags ?? []} />
              <InkNodeSlider
                label="闭关年限"
                values={RETREAT_YEARS}
                value={years}
                unit="年"
                disabled={unavailable}
                onChange={(value) => handleRetreatYearsChange(String(value))}
              />
              <p
                className="text-ink-secondary text-xs leading-6"
                aria-live="polite"
              >
                余寿 <span className="font-mono">{remainingLifespan}</span> 年
                {years >= remainingLifespan ? (
                  <span className="text-crimson"> · 此次闭关将耗尽寿元</span>
                ) : null}
              </p>
              <InkButton
                onClick={handleRetreat}
                pending={retreatLoading}
                pendingLabel="入定中……"
                disabled={pillPending}
                variant="primary"
              >
                入定闭关
              </InkButton>
            </>
          ) : (
            <>
              <div className="space-y-2">
                {nextStage ? (
                  <p className="text-base leading-7">
                    {cultivator.realm}
                    {cultivator.realm_stage}
                    <span className="text-ink-secondary mx-3">至</span>
                    <span className="text-teal">
                      {nextStage.realm}
                      {nextStage.stage}
                    </span>
                  </p>
                ) : null}
              </div>
              <BreakthroughReadiness progress={cultivationProgress} />
              <p
                className="text-ink-secondary text-sm leading-7"
                aria-live="polite"
              >
                {guidance}
              </p>
              <ActiveMedicine
                tags={retreatEfficiency?.breakthroughTags ?? []}
              />
              <BreakthroughWarnings preview={breakthroughPreview} />
              {isMajorBreakthrough && majorBreakthroughBlocked ? (
                taskError ? (
                  <InkNotice>
                    {taskError}
                    <InkButton onClick={() => void reloadTasks()}>
                      重新核对准备
                    </InkButton>
                  </InkNotice>
                ) : currentMajorTask ? (
                  <BreakthroughTaskCard task={currentMajorTask} compact />
                ) : !tasksLoading ? (
                  <InkButton onClick={() => void reloadTasks()}>
                    重新核对准备
                  </InkButton>
                ) : null
              ) : null}
              <InkButton
                onClick={handleBreakthroughClick}
                disabled={!canAttemptBreakthrough || pillPending}
                pending={retreatLoading}
                pendingLabel="冲关中……"
                variant="primary"
              >
                尝试突破
              </InkButton>
            </>
          )}
        </div>
      </div>

      <PillQuickbar
        disabled={unavailable || showBreakthroughConfirm || retreatResultOpen}
        onPendingChange={setPillPending}
      />

      <BreakthroughConfirmModal
        isOpen={showBreakthroughConfirm}
        onClose={closeBreakthroughConfirm}
        onConfirm={handleBreakthrough}
        chancePreview={breakthroughPreview}
        isMajorBreakthrough={isMajorBreakthrough}
        qiCost={QI_ACTION_COSTS.breakthrough_attempt}
      />
      <RetreatResultModal
        isOpen={retreatResultOpen}
        retreatResult={retreatResult}
        isStreaming={retreatResultStreaming}
        celebrationTick={celebrationTick}
        onClose={closeRetreatResult}
        onGoReincarnate={handleGoReincarnate}
        allowAttributeNavigation={!sectContext}
      />
    </GameSceneFrame>
  );
}
