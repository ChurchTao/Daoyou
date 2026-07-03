import { cn } from '@shared/lib/cn';
import type { AffixView } from './abilityDisplay';
import {
  getAffixToneStyle,
  getAffixUnderlineStyle,
  getPerfectMarkStyle,
} from './affixPresentation';

interface AffixInlineListProps {
  affixes: AffixView[];
  label?: string;
  className?: string;
}

function AffixInlineToken({ affix }: { affix: AffixView }) {
  return (
    <span
      className="inline-flex max-w-full items-center"
      data-affix-inline-token={affix.id}
    >
      <span
        className="relative inline-flex max-w-full items-center border-b border-dashed pr-2 pb-px"
        style={getAffixUnderlineStyle(affix.isPerfect)}
      >
        <span
          className="truncate font-medium leading-snug"
          style={getAffixToneStyle(affix.rarityTone)}
        >
          {affix.name}
        </span>
        {affix.globalUniqueText && (
          <span
            className="ml-1 rounded border border-current/30 px-1 text-[10px] leading-4"
            title={affix.globalUniqueText}
          >
            唯一
          </span>
        )}
        {affix.isPerfect && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-0.5 text-xs font-semibold leading-none"
            data-affix-perfect-mark="embedded"
            style={getPerfectMarkStyle()}
          >
            极
          </span>
        )}
      </span>
    </span>
  );
}

export function AffixInlineList({
  affixes,
  label = '词缀',
  className,
}: AffixInlineListProps) {
  if (affixes.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', className)}>
      <span className="text-ink-secondary shrink-0">{label}：</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-2.5 gap-y-1">
        {affixes.map((affix) => (
          <AffixInlineToken key={affix.id} affix={affix} />
        ))}
      </div>
    </div>
  );
}
