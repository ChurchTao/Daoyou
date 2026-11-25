import type { ComponentProps } from 'react';

export function ActivityCardInfoButton(
  props: Omit<ComponentProps<'button'>, 'children' | 'className' | 'type'>,
) {
  return (
    <button
      {...props}
      type="button"
      className="group/card-info text-ink-secondary focus-visible:outline-crimson absolute end-0 top-0 grid size-11 cursor-pointer place-items-start justify-items-end px-1.5 py-1 focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <span
        aria-hidden="true"
        className="border-ink-border bg-paper group-hover/card-info:border-crimson group-hover/card-info:text-crimson group-focus-visible/card-info:border-crimson group-focus-visible/card-info:text-crimson group-aria-expanded/card-info:border-crimson group-aria-expanded/card-info:text-crimson grid size-[1.15rem] place-items-center rounded-full border font-mono text-xs leading-none font-semibold"
      >
        ?
      </span>
    </button>
  );
}
