import { cn } from '@shared/lib/cn';
import type { ReactNode } from 'react';

export interface GameSceneSectionProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function GameSceneSection({
  title,
  children,
  className,
  contentClassName,
}: GameSceneSectionProps) {
  return (
    <section
      className={cn(
        'min-w-0 [&+&]:mt-5! [&+&]:border-t [&+&]:border-dashed [&+&]:border-ink/15 [&+&]:pt-4',
        className,
      )}
    >
      {title ? (
        <div
          role="heading"
          aria-level={2}
          className="text-ink mb-3 font-sans text-[clamp(1rem,0.95rem+0.35vw,1.125rem)] font-semibold leading-7 tracking-[0.04em]"
        >
          {title}
        </div>
      ) : null}
      <div className={cn(contentClassName)}>{children}</div>
    </section>
  );
}
