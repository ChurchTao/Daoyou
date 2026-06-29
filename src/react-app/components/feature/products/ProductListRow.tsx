import { InkBadge } from '@app/components/ui/InkBadge';
import { getElementInfo } from '@shared/lib/gameConceptDisplay';
import { cn } from '@shared/lib/cn';
import type { ElementType, Quality } from '@shared/types/constants';
import type { ReactNode } from 'react';
import { getScoreMark } from './scoreMeta';

export type ProductListRowState = 'normal' | 'active' | 'selected' | 'pending';

export interface ProductElementMarkProps {
  element?: ElementType;
  className?: string;
}

export function ProductElementMark({
  element,
  className,
}: ProductElementMarkProps) {
  if (!element) return null;

  const info = getElementInfo(element);

  return (
    <span
      className={cn(
        'text-ink-secondary inline-flex items-center gap-1 text-sm leading-5',
        className,
      )}
      data-product-element-mark={element}
    >
      <span aria-hidden="true">{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
}

export function ProductStateMark({
  state,
  label,
}: {
  state: ProductListRowState;
  label?: string;
}) {
  if (state === 'normal') return null;

  const markClass =
    state === 'selected'
      ? 'border-wood/60 bg-wood/15 text-wood'
      : state === 'pending'
        ? 'border-crimson/45 bg-crimson/8 text-crimson'
        : 'border-crimson/55 bg-crimson/10 text-crimson';

  return (
    <span
      className={cn(
        'pointer-events-none absolute top-2 right-2 h-2.5 w-2.5 border',
        state === 'selected' ? 'rotate-45' : 'rounded-full',
        markClass,
      )}
      aria-label={label}
      title={label}
      data-product-state-mark={state}
    />
  );
}

export interface ProductListRowProps {
  icon: string;
  name: string;
  quality?: Quality;
  element?: ElementType;
  score?: number;
  state?: ProductListRowState;
  stateLabel?: string;
  meta?: ReactNode;
  description?: string;
  actions?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
}

export function ProductListRow({
  icon,
  name,
  quality,
  element,
  score,
  state = 'normal',
  stateLabel,
  meta,
  description,
  actions,
  onSelect,
  selected = false,
}: ProductListRowProps) {
  const hasMetaLine = Boolean(element || (score && score > 0));
  const row = (
    <div
      className={cn(
        'border-ink/10 relative border-b border-dashed px-2 py-2 pl-3',
        state !== 'normal' && 'before:absolute before:top-2 before:bottom-2 before:left-0 before:w-px',
        state === 'active' && 'border-b-crimson/30 bg-crimson/5 before:bg-crimson/55',
        state === 'selected' && 'border-b-wood/40 bg-wood/8 outline-1 outline-wood/25 before:bg-wood/65',
        state === 'pending' && 'border-b-crimson/25 bg-crimson/4 before:bg-crimson/35',
      )}
      data-product-list-row
      data-product-row-state={state}
      aria-label={stateLabel}
      title={stateLabel}
    >
      <ProductStateMark state={state} label={stateLabel} />
      <div className="space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-4 text-base leading-6">
          <span className="shrink-0 leading-6">{icon}</span>
          <span className="text-ink-secondary min-w-0 truncate font-bold leading-6">
            {name}
          </span>
          {quality ? (
            <InkBadge tier={quality} className="px-0 text-base leading-6" />
          ) : null}
        </div>

        {hasMetaLine ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-5">
            <ProductElementMark element={element} />
            {getScoreMark(score)}
          </div>
        ) : null}

        {meta ? <div className="pt-0.5">{meta}</div> : null}
        {description ? (
          <div className="text-ink-secondary text-sm leading-relaxed opacity-80">
            {description}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div
          className="mt-2 flex w-full flex-wrap justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );

  if (!onSelect) return row;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className="w-full cursor-pointer text-left"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {row}
    </div>
  );
}
