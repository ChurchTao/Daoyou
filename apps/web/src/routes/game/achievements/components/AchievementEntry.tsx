import { achievementIcon } from '@app/components/feature/achievements/achievementIcons';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type { AchievementView } from '@daoyou/contracts/achievements';
import { useEffect, useId, useRef } from 'react';
import {
  achievementDate,
  achievementRatio,
  isAwaitingRecord,
} from '../achievementPresentation';

export function AchievementEntry({
  achievement,
  next,
  expanded,
  onToggle,
  onRefresh,
  loading,
}: {
  achievement: AchievementView;
  next: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const detailsId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (expanded) trigger.current?.scrollIntoView({ block: 'nearest' });
  }, [expanded]);
  const awaiting = isAwaitingRecord(achievement);
  const showProgress =
    !achievement.unlocked &&
    !achievement.blockedReason &&
    Boolean(achievement.unit) &&
    achievement.progress.target > 1;
  return (
    <li
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) {
          event.stopPropagation();
          onToggle();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        onClick={onToggle}
        className={cn(
          'focus-visible:outline-crimson hover:bg-ink/3 grid w-full cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_0.75rem] items-start gap-3 px-1 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_0.75rem] sm:gap-4 sm:px-2',
          expanded && 'bg-ink/3',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-9 items-center justify-center rounded-full sm:size-10',
            achievement.unlocked ? 'bg-teal/8' : 'bg-ink/4',
          )}
        >
          <GameIcon
            value={achievementIcon(achievement)}
            className={cn(
              'text-2xl',
              !achievement.unlocked && 'opacity-65 saturate-50',
            )}
          />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-ink text-base leading-6 font-semibold break-words">
              {achievement.name}
            </span>
            <span
              className={cn(
                'shrink-0 text-xs leading-6',
                achievement.unlocked
                  ? 'text-teal'
                  : awaiting
                    ? 'text-crimson'
                    : 'text-ink-secondary',
              )}
            >
              {achievement.unlocked ? (
                '✓ 已获得'
              ) : achievement.blockedReason ? (
                '无法达成'
              ) : awaiting ? (
                '等待记入'
              ) : showProgress ? (
                <>
                  <span className="sr-only">未获得，进度</span>
                  <span className="font-mono">
                    {achievement.progress.current}/{achievement.progress.target}
                  </span>{' '}
                  {achievement.unit}
                </>
              ) : (
                '未获得'
              )}
            </span>
          </span>
          <span className="text-ink-secondary mt-0.5 block text-sm leading-6 break-words">
            {achievement.condition}
          </span>
          {next && showProgress ? (
            <span
              role="progressbar"
              aria-label={achievement.name + '进度'}
              aria-valuemin={0}
              aria-valuemax={achievement.progress.target}
              aria-valuenow={Math.min(
                achievement.progress.current,
                achievement.progress.target,
              )}
              aria-valuetext={
                achievement.progress.current +
                ' / ' +
                achievement.progress.target +
                achievement.unit
              }
              className="bg-ink/8 mt-2 block h-0.5 w-24"
            >
              <span
                className="bg-ink/35 block h-full"
                style={{ width: achievementRatio(achievement) * 100 + '%' }}
              />
            </span>
          ) : null}
        </span>
        <span aria-hidden className="text-ink-secondary/65 pt-1 text-xs">
          {expanded ? '−' : '+'}
        </span>
      </button>
      {expanded ? (
        <div
          id={detailsId}
          className="border-ink/15 ml-12 space-y-2 border-l pb-4 pl-3 text-xs leading-6 sm:ml-16"
        >
          <p className="text-ink-secondary">{achievement.description}</p>
          {achievement.unlocked ? (
            <p className="text-teal">
              获得于{' '}
              <time dateTime={achievement.unlockedAt ?? undefined}>
                {achievementDate(achievement.unlockedAt)}
              </time>
            </p>
          ) : achievement.blockedReason ? (
            <p className="text-ink-secondary">{achievement.blockedReason}</p>
          ) : awaiting ? (
            <div className="space-y-1">
              <p className="text-ink-secondary">
                达成事实已记录，成就正在更新。
              </p>
              <InkButton
                onClick={onRefresh}
                pending={loading}
                className="min-h-11"
              >
                刷新记录
              </InkButton>
            </div>
          ) : null}
          {achievement.trackingHint ? (
            <p className="text-ink-secondary">{achievement.trackingHint}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
