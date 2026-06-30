import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';
import { useInkUI } from '../providers/InkUIProvider';

export interface GameSceneHelp {
  title: string;
  content: ReactNode;
  label?: string;
  confirmLabel?: string;
}

export interface GameSceneSectionProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  help?: GameSceneHelp;
  actions?: ReactNode;
}

export function GameSceneHelpButton({ help }: { help: GameSceneHelp }) {
  const { openDialog } = useInkUI();
  const label = help.label ?? '说明';

  return (
    <button
      type="button"
      aria-label={help.title}
      title={help.title}
      onClick={() =>
        openDialog({
          title: help.title,
          content: help.content,
          confirmLabel: help.confirmLabel ?? '知晓了',
          cancelLabel: null,
        })
      }
      className="border-ink/30 text-battle-muted hover:border-crimson/50 hover:text-crimson inline-flex shrink-0 items-center border-b border-dashed px-0.5 py-0 font-sans text-[0.78rem] leading-6 tracking-[0.08em] transition-colors"
    >
      {label}
    </button>
  );
}

export function GameSceneSection({
  title,
  children,
  className,
  contentClassName,
  help,
  actions,
}: GameSceneSectionProps) {
  return (
    <section
      className={cn(
        '[&+&]:border-ink/15 min-w-0 [&+&]:mt-5! [&+&]:border-t [&+&]:border-dashed [&+&]:pt-4',
        className,
      )}
    >
      {title || help || actions ? (
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          {title ? (
            <span
              role="heading"
              aria-level={2}
              className="text-ink min-w-0 font-sans text-[clamp(1rem,0.95rem+0.35vw,1.125rem)] leading-7 font-semibold tracking-[0.04em]"
            >
              「{title}」
            </span>
          ) : (
            <span />
          )}
          {actions || help ? (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              {help ? <GameSceneHelpButton help={help} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn(contentClassName)}>{children}</div>
    </section>
  );
}
