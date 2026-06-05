import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { claimTaskReward } from '@app/lib/tasks/taskClient';
import { cn } from '@shared/lib/cn';
import { getNoviceEquipmentState } from '@shared/lib/noviceGuidance';
import type { TaskInstance } from '@shared/types/task';
import { useState } from 'react';

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: 'ready' | 'pending' | 'done';
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] tracking-[0.08em]',
        tone === 'ready'
          ? 'border-emerald-700/25 bg-emerald-50 text-emerald-800'
          : tone === 'done'
            ? 'border-ink/10 bg-ink/5 text-ink-secondary'
            : 'border-amber-700/25 bg-amber-50 text-amber-900',
      )}
    >
      {text}
    </span>
  );
}

export function TutorialTaskCard({
  task,
  className,
  onClaimed,
}: {
  task: TaskInstance;
  className?: string;
  onClaimed?: () => Promise<void> | void;
}) {
  const { pushToast } = useInkUI();
  const { cultivator, refreshCultivator, refreshInventory } = useCultivator();
  const [claiming, setClaiming] = useState(false);
  const currentStage =
    task.snapshot.stages.find((stage) => stage.current) ??
    task.snapshot.stages[0] ??
    null;
  const rewardSummary = task.snapshot.rewardSummary ?? task.metadata.rewardSummary ?? [];
  const rewardClaimedAt =
    task.snapshot.rewardClaimedAt ?? task.metadata.rewardClaimedAt;
  const needsStarterRewardRepair =
    task.definitionId === 'tutorial_starter_supply' &&
    Boolean(rewardClaimedAt) &&
    !task.metadata.rewardGrantedKey &&
    Boolean(cultivator && !getNoviceEquipmentState(cultivator).hasFullSet);
  const canClaim =
    task.status === 'completed' && (!rewardClaimedAt || needsStarterRewardRepair);

  const handleClaim = async () => {
    if (!canClaim || claiming) return;

    setClaiming(true);
    try {
      const result = await claimTaskReward(task.id);
      await Promise.all([
        refreshCultivator(),
        refreshInventory(['materials', 'artifacts', 'consumables']),
        onClaimed?.(),
      ]);
      pushToast({
        message: `奖励邮件已送达：${result.data.rewards.join('，')}`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '领取奖励失败',
        tone: 'danger',
      });
    } finally {
      setClaiming(false);
    }
  };

  const statusText = rewardClaimedAt
    ? '奖励已寄'
    : task.status === 'completed'
      ? '可领取'
      : '进行中';
  const statusTone = rewardClaimedAt
    ? 'done'
    : task.status === 'completed'
      ? 'ready'
      : 'pending';

  return (
    <div
      className={cn(
        'space-y-4 border border-amber-800/15 bg-[rgba(249,245,235,0.9)] p-4',
        className,
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold tracking-[0.04em] text-ink">
            {task.snapshot.title}
          </p>
          <StatusPill text={statusText} tone={statusTone} />
        </div>
        <p className="text-sm leading-7 text-ink-secondary">
          {currentStage?.description ?? task.snapshot.summary}
        </p>
      </div>

      {currentStage ? (
        <div className="space-y-2 text-sm leading-7">
          {currentStage.objectives.map((objective) => (
            <div key={objective.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink">{objective.title}</p>
                <p className="text-xs leading-6 text-ink-secondary">
                  {objective.progressText}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  objective.completed ? 'text-emerald-700' : 'text-ink-secondary',
                )}
              >
                {objective.completed ? '已成' : '待办'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {rewardSummary.length > 0 ? (
        <p className="text-xs leading-6 text-ink-secondary">
          阶段奖励：{rewardSummary.join('，')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canClaim ? (
          <InkButton variant="primary" onClick={handleClaim} disabled={claiming}>
            {claiming
              ? '领取中...'
              : needsStarterRewardRepair
                ? '补发奖励'
                : '领取奖励'}
          </InkButton>
        ) : null}
        {task.status !== 'completed' && currentStage
          ? currentStage.links.map((link) => (
              <InkButton key={`${task.id}:${link.href}:${link.label}`} href={link.href}>
                {link.label}
              </InkButton>
            ))
          : null}
        {rewardClaimedAt && currentStage
          ? currentStage.links.slice(0, 2).map((link) => (
              <InkButton key={`${task.id}:done:${link.href}:${link.label}`} href={link.href}>
                {link.label}
              </InkButton>
            ))
          : null}
      </div>
    </div>
  );
}
