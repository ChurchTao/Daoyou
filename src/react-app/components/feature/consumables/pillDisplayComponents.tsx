import {
  getAffixToneStyle,
  getAffixUnderlineStyle,
} from '@app/components/feature/products/affixPresentation';
import { InkBadge } from '@app/components/ui/InkBadge';
import { getPillAppearanceColorClass } from '@shared/lib/pillAppearance';
import { formatPillScore } from '@shared/lib/pillScore';
import { cn } from '@shared/lib/cn';
import type { PillDetailGroup, PillDisplayModel } from './pillDisplayModel';

type PillAppearanceDisplay = NonNullable<PillDisplayModel['appearance']>;

export function PillAppearanceMark({
  appearance,
  className,
}: {
  appearance?: PillAppearanceDisplay;
  className?: string;
}) {
  if (!appearance) return null;

  return (
    <span
      className={cn(
        'relative inline-flex max-w-full text-sm font-semibold leading-none',
        getPillAppearanceColorClass(appearance.grade),
        className,
      )}
      data-pill-appearance={appearance.grade}
    >
      {appearance.label}
    </span>
  );
}

export function PillScoreMark({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-ink-secondary/70 pointer-events-none inline-flex h-4 items-center gap-1 text-[0.68rem] leading-4',
        className,
      )}
      data-pill-score-mark
    >
      <span
        aria-hidden="true"
        className="border-crimson/45 bg-crimson/8 inline-block h-1.5 w-1.5 shrink-0 rotate-45 border"
      />
      <span className="border-ink/20 inline-flex h-4 items-center border-b border-dashed leading-4">
        {formatPillScore(score)}
      </span>
    </span>
  );
}

export function PillKeywordLine({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;

  return (
    <div className="text-ink-secondary flex flex-wrap gap-x-2 gap-y-1 text-xs">
      {labels.map((label, index) => (
        <span
          key={`${label}-${index}`}
          className="relative inline-flex border-b border-dashed pb-px"
          data-pill-keyword={label}
          style={
            label.includes('丹毒')
              ? {
                  ...getAffixUnderlineStyle(false),
                  color: 'rgba(193, 18, 31, 0.76)',
                }
              : {
                  ...getAffixUnderlineStyle(false),
                  ...getAffixToneStyle(
                    label.startsWith('剩余') ||
                      label.startsWith('寿元丹剩余') ||
                      label.startsWith('服用上限')
                      ? 'info'
                      : 'muted',
                  ),
                }
          }
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function PillSummary({ model }: { model: PillDisplayModel }) {
  return (
    <div className="border-ink/10 space-y-2 border border-dashed px-3 py-2 text-left">
      {model.appearance && (
        <div className="flex items-center justify-end">
          <PillAppearanceMark appearance={model.appearance} />
        </div>
      )}
      <div className="text-ink text-sm leading-relaxed font-semibold">
        {model.primaryEffect}
      </div>
      <PillKeywordLine labels={model.keywordLabels} />
    </div>
  );
}

export function PillDetailGroups({ groups }: { groups: PillDetailGroup[] }) {
  return (
    <div className="space-y-3">
      {groups
        .filter((group) => group.lines.length > 0)
        .map((group) => (
          <section key={group.key} className="space-y-1">
            <h3 className="text-ink-secondary text-sm font-semibold tracking-wide">
              {group.title}
            </h3>
            <ul className="list-inside list-disc">
              {group.lines.map((line, index) => (
                <li
                  key={`${group.key}-${line}-${index}`}
                  className="text-ink/75 px-2 py-0.5 leading-relaxed"
                >
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

export function PillKeywordBadges({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label, index) => (
        <InkBadge key={`${label}-${index}`} tone="default">
          {label}
        </InkBadge>
      ))}
    </div>
  );
}
