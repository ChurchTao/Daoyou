import {
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
  GameSceneTabs,
} from '@app/components/game-shell';
import { InkButton, InkInput, InkNotice } from '@app/components/ui';
import { QI_ACTION_COSTS } from '@shared/config/qiSystem';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import type { TaskInstance } from '@shared/types/task';

import { cn } from '@shared/lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BreakthroughConfirmModal } from './BreakthroughConfirmModal';
import type {
  RetreatBuffTag,
  RetreatEfficiencyModel,
} from './retreatEfficiency';
import { RetreatResultModal } from './RetreatResultModal';
import {
  useRetreatViewModel,
  type CultivationProgressData,
} from './useRetreatViewModel';

const COMPREHENSION_LABEL = getGameConceptLabel('comprehension_insight');

function BreakthroughLabel({
  type,
}: {
  type: 'forced' | 'normal' | 'perfect' | null;
}) {
  if (!type) return null;
  return (
    <span
      className={cn([
        type === 'perfect' && 'text-red-500',
        type === 'normal' && 'text-blue-500',
        type === 'forced' && 'text-green-500',
      ])}
    >
      {getBreakthroughTypeText(type)}
    </span>
  );
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
            修为达到 100%，且{COMPREHENSION_LABEL}至少达到 50
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

function RetreatBuffTags({
  tags,
  emptyHint,
  showShortcuts = true,
}: {
  tags: RetreatBuffTag[];
  emptyHint?: string | null;
  showShortcuts?: boolean;
}) {
  if (tags.length === 0 && !emptyHint) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className={cn(
            'border-ink/15 bg-bgpaper/70 inline-flex max-w-full items-center gap-1.5 border border-dashed px-2 py-1 text-xs leading-5',
            tag.tone === 'positive' && 'border-emerald-700/25 text-emerald-800',
            tag.tone === 'warning' && 'border-wood/35 text-wood',
          )}
        >
          <span aria-hidden="true">{tag.icon}</span>
          <span className="truncate">{tag.label}</span>
          {tag.value ? <span className="font-mono">{tag.value}</span> : null}
        </span>
      ))}
      {emptyHint ? (
        <span className="text-ink-secondary inline-flex items-center gap-1.5 text-xs leading-5">
          <span aria-hidden="true">🌿</span>
          <span>{emptyHint}</span>
          {showShortcuts ? (
            <>
              <InkButton href="/game/inventory" variant="ghost">
                背包
              </InkButton>
              <InkButton href="/game/craft/alchemy" variant="ghost">
                炼丹
              </InkButton>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

type RetreatSceneTab = 'retreat' | 'breakthrough';

function getRetreatLeadText({
  isMajorBreakthrough,
  majorBreakthroughBlocked,
}: {
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
}) {
  if (isMajorBreakthrough && majorBreakthroughBlocked) {
    return '石门一合，静室里只余炉火与回声。破境前置尚未补齐时，闭关更像是收拢气息，静待下一次起手。';
  }

  if (isMajorBreakthrough) {
    return '炉火已稳，卷宗也已齐备。若暂不冲关，也可先把这一段静坐坐实。';
  }

  return '蒲团、丹炉与静香都已备好。定下这次要坐多少年，便可入定温养道基。';
}

function getBreakthroughLeadText({
  canBreakthrough,
  isMajorBreakthrough,
  majorBreakthroughBlocked,
}: {
  canBreakthrough: boolean;
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
}) {
  if (isMajorBreakthrough && majorBreakthroughBlocked) {
    return '这一关已临大境界门前，但破境卷宗还没补齐。先看缺什么，再决定何时冲关。';
  }
  if (!canBreakthrough) {
    return '火候尚浅，静室暂不适合冲关。';
  }
  return '火候已至，若要推门破关，先看眼前药力与心境是否齐备。';
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

function RetreatCultivationPanel({
  isMajorBreakthrough,
  majorBreakthroughBlocked,
  retreatYears,
  parsedRetreatYears,
  retreatEfficiency,
  retreatLoading,
  onRetreatYearsChange,
  onRetreat,
  showShortcuts,
}: {
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
  retreatYears: string;
  parsedRetreatYears: number;
  retreatEfficiency: RetreatEfficiencyModel | null;
  retreatLoading: boolean;
  onRetreatYearsChange: (value: string) => void;
  onRetreat: () => Promise<void>;
  showShortcuts: boolean;
}) {
  return (
    <div className="border-ink/10 bg-bgpaper/70 space-y-5 border border-dashed px-4 py-4 md:px-5">
      <p className="text-sm leading-7">
        {getRetreatLeadText({
          isMajorBreakthrough,
          majorBreakthroughBlocked,
        })}
      </p>

      <div className="space-y-3">
        <InkInput
          label="闭关年限"
          value={retreatYears}
          placeholder="输入 1~200 之间的整数"
          onChange={onRetreatYearsChange}
          hint={
            parsedRetreatYears > 0
              ? `本次将消耗寿元 ${parsedRetreatYears} 年。`
              : '定下年限后即可入定。'
          }
        />
        <RetreatBuffTags
          tags={retreatEfficiency?.retreatTags ?? []}
          emptyHint={retreatEfficiency?.emptyHint}
          showShortcuts={showShortcuts}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <InkButton
          onClick={onRetreat}
          disabled={retreatLoading}
          variant="primary"
        >
          {retreatLoading ? '修炼中……' : '闭关修炼'}
        </InkButton>
      </div>
    </div>
  );
}

function BreakthroughPanel({
  cultivationProgress,
  canAttemptBreakthrough,
  guidanceText,
  retreatEfficiency,
  isMajorBreakthrough,
  majorBreakthroughBlocked,
  tasksLoading,
  taskError,
  currentMajorTask,
  missingRequirements,
  retreatLoading,
  onBreakthroughClick,
}: {
  cultivationProgress: CultivationProgressData | null;
  canAttemptBreakthrough: boolean;
  guidanceText: string;
  retreatEfficiency: RetreatEfficiencyModel | null;
  isMajorBreakthrough: boolean;
  majorBreakthroughBlocked: boolean;
  tasksLoading: boolean;
  taskError: string | undefined;
  currentMajorTask: TaskInstance | null;
  missingRequirements: string[];
  retreatLoading: boolean;
  onBreakthroughClick: () => void;
}) {
  return (
    <div className="border-ink/10 bg-bgpaper/70 space-y-5 border border-dashed px-4 py-4 md:px-5">
      <div className="space-y-3 text-sm leading-7">
        <p>
          {getBreakthroughLeadText({
            canBreakthrough: Boolean(cultivationProgress?.canBreakthrough),
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
        </div>
        <RetreatBuffTags tags={retreatEfficiency?.breakthroughTags ?? []} />
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

      <div className="flex flex-wrap gap-2">
        {canAttemptBreakthrough ? (
          <InkButton onClick={onBreakthroughClick} disabled={retreatLoading}>
            {retreatLoading ? '冲关中……' : '尝试突破'}
          </InkButton>
        ) : null}
      </div>
    </div>
  );
}

export type RetreatViewProps = {
  sectContext?: {
    facilityLevel: number;
    experienceBonusPercent: number;
    facilityLabel: string;
    scene: import('@shared/engine/sect').SectScenePresentation;
  };
};

export function RetreatView({ sectContext }: RetreatViewProps) {
  const [activeTab, setActiveTab] = useState<RetreatSceneTab>('retreat');
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
  const shouldHoldResultShell =
    !cultivator && retreatResultOpen && Boolean(retreatResult?.depleted);
  const headerMeta =
    sectContext || note ? (
      <div className="space-y-3">
        {sectContext ? (
          <InkButton onClick={() => navigate('/game/sect')} variant="secondary">
            返回宗门总视图
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
  const parsedRetreatYears = Number(retreatYears || '0');
  const breakthroughQiCost = QI_ACTION_COSTS.breakthrough_attempt;

  return (
    <GameSceneFrame
      title={sectContext ? sectContext.scene.title : '静室修行'}
      description={sectContext ? sectContext.scene.description : undefined}
      identityOverride={
        sectContext
          ? {
              label: sectContext.scene.title,
              summary: sectContext.scene.description,
            }
          : undefined
      }
      headerMeta={headerMeta}
      aside={
        sectContext ? (
          <div className="space-y-2 text-sm leading-7">
            <p>
              {sectContext.facilityLabel}等级：{sectContext.facilityLevel}级
            </p>
            <p>闭关修为加成：+{sectContext.experienceBonusPercent}%</p>
          </div>
        ) : undefined
      }
      contentClassName={
        sectContext
          ? 'bg-[radial-gradient(circle_at_50%_18%,rgba(64,148,135,0.16)_0_10%,transparent_11%_25%,rgba(64,148,135,0.08)_26%_27%,transparent_28%),linear-gradient(180deg,rgba(205,228,215,0.22),transparent_55%)] px-3 py-4 sm:px-5'
          : undefined
      }
    >
      <GameSceneSection
        title="静室所行"
        help={{
          title: '突破火候说明',
          content: (
            <BreakthroughHelpContent
              breakthroughType={cultivationProgress?.breakthroughType ?? null}
              canBreakthrough={Boolean(cultivationProgress?.canBreakthrough)}
              isMajorBreakthrough={isMajorBreakthrough}
              majorBreakthroughBlocked={majorBreakthroughBlocked}
            />
          ),
        }}
      >
        <div className="space-y-4">
          <GameSceneTabs
            items={[
              { label: '闭关', value: 'retreat' },
              { label: '突破', value: 'breakthrough' },
            ]}
            activeValue={activeTab}
            onChange={(value) => setActiveTab(value as RetreatSceneTab)}
          />

          {activeTab === 'retreat' ? (
            <RetreatCultivationPanel
              isMajorBreakthrough={isMajorBreakthrough}
              majorBreakthroughBlocked={majorBreakthroughBlocked}
              retreatYears={retreatYears}
              parsedRetreatYears={parsedRetreatYears}
              retreatEfficiency={retreatEfficiency}
              retreatLoading={retreatLoading}
              onRetreatYearsChange={handleRetreatYearsChange}
              onRetreat={handleRetreat}
              showShortcuts={!sectContext}
            />
          ) : (
            <BreakthroughPanel
              cultivationProgress={cultivationProgress}
              canAttemptBreakthrough={canAttemptBreakthrough}
              guidanceText={guidanceText}
              retreatEfficiency={retreatEfficiency}
              isMajorBreakthrough={isMajorBreakthrough}
              majorBreakthroughBlocked={majorBreakthroughBlocked}
              tasksLoading={tasksLoading}
              taskError={taskError}
              currentMajorTask={currentMajorTask}
              missingRequirements={missingRequirements}
              retreatLoading={retreatLoading}
              onBreakthroughClick={handleBreakthroughClick}
            />
          )}
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
              label={COMPREHENSION_LABEL}
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
        qiCost={breakthroughQiCost}
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
