import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type {
  MentorshipGraduationProgress,
  MentorshipMilestoneKey,
} from '@daoyou/contracts/mentorship';
import { useId } from 'react';

const milestoneActions: Record<
  MentorshipMilestoneKey,
  { href: string; label: string; unit: string }
> = {
  realm: { href: '/game/retreat', label: '继续闭关', unit: '' },
  manual: {
    href: '/game/cultivator?tab=manuals',
    label: '修炼功法',
    unit: '层',
  },
  sect_methods: {
    href: '/game/sect/archive/methods',
    label: '研修心法',
    unit: '门',
  },
  body: {
    href: '/game/cultivator?tab=body',
    label: '锤炼体魄',
    unit: '轨',
  },
};
const ordinals = ['一', '二', '三', '四'];

export function GraduationProgress({
  progress,
  actions = true,
  title = '出师进境',
}: {
  progress: MentorshipGraduationProgress;
  actions?: boolean;
  title?: string;
}) {
  const titleId = useId();
  const completed = progress.milestones.filter((item) => item.complete).length;

  return (
    <section aria-labelledby={titleId}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-ink-secondary shrink-0 text-sm">
          已达成{' '}
          <span
            className={cn(
              'font-mono font-semibold tracking-tight',
              completed === progress.milestones.length && 'text-teal',
            )}
          >
            {completed} / {progress.milestones.length}
          </span>
        </p>
      </header>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {progress.milestones.map((item) => (
          <div
            key={item.key}
            className={cn(
              'h-1 flex-1',
              item.complete ? 'bg-teal/70' : 'bg-ink/10',
            )}
          />
        ))}
      </div>
      <ol className="mt-2 md:grid md:grid-cols-2 md:gap-x-8">
        {progress.milestones.map((item, index) => {
          const action = milestoneActions[item.key];
          const ratio = Math.min(
            100,
            Math.max(0, (item.current / Math.max(1, item.required)) * 100),
          );

          return (
            <li
              key={item.key}
              className="border-ink/10 grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 border-b py-4 last:border-b-0 sm:gap-x-3 md:[&:nth-last-child(2)]:border-b-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'pt-0.5 text-sm',
                  item.complete ? 'text-teal' : 'text-ink-secondary/60',
                )}
              >
                {ordinals[index] ?? index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold">{item.label}</h3>
                  <p
                    className={cn(
                      'text-sm',
                      item.complete ? 'text-teal' : 'text-ink-secondary',
                    )}
                  >
                    {item.complete ? (
                      '已达成'
                    ) : item.key === 'realm' ? (
                      '修行中'
                    ) : (
                      <>
                        <span className="font-mono">
                          {item.current} / {item.required}
                        </span>{' '}
                        {action.unit}
                      </>
                    )}
                  </p>
                </div>
                <p className="text-ink-secondary mt-1 text-sm leading-6">
                  {item.detail}
                </p>
                {item.key !== 'realm' ? (
                  <div
                    role="progressbar"
                    aria-label={item.label}
                    aria-valuemin={0}
                    aria-valuemax={item.required}
                    aria-valuenow={Math.min(item.current, item.required)}
                    aria-valuetext={`${item.current} / ${item.required}${action.unit}${item.complete ? '，已达成' : ''}`}
                    className="bg-ink/8 mt-2.5 h-0.5 max-w-xs overflow-hidden"
                  >
                    <div
                      className={cn(
                        'h-full',
                        item.complete ? 'bg-teal/70' : 'bg-ink/25',
                      )}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                ) : null}
                {actions && !item.complete ? (
                  <div className="mt-1 -ml-1.5">
                    <InkButton
                      href={action.href}
                      variant="default"
                      className="min-h-11"
                    >
                      {action.label}
                    </InkButton>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
