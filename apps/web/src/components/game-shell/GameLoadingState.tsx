import { InkLoadingBar } from '@app/components/ui/InkLoadingBar';
import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';

export interface GameLoadingStateProps {
  message: ReactNode;
  variant: 'scene' | 'inline' | 'immersive' | 'fullscreen';
  immediate?: boolean;
  className?: string;
}

const variantClassNames: Record<GameLoadingStateProps['variant'], string> = {
  scene: 'flex h-full min-h-48 items-center justify-center px-4',
  inline: 'flex min-h-20 items-center justify-center py-4 text-center',
  immersive: 'flex h-full min-h-48 items-center justify-center text-[#e7dcc6]',
  fullscreen:
    'app-safe-area-page bg-paper flex min-h-[100svh] items-center justify-center',
};

export function GameLoadingState({
  message,
  variant,
  immediate = false,
  className,
}: GameLoadingStateProps) {
  const inverse = variant === 'immersive';
  const inline = variant === 'inline';

  return (
    <div
      className={cn(variantClassNames[variant], className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={cn(
          'flex flex-col items-center gap-4',
          !immediate && 'ink-loading-delay',
        )}
      >
        <InkLoadingBar
          tone={inverse ? 'inverse' : 'ink'}
          size={inline ? 'inline' : 'scene'}
          immediate
        />
        <div
          className={cn(
            'text-sm leading-7 tracking-[0.12em]',
            inverse ? 'text-[#d8cba9]' : 'text-ink-secondary',
          )}
        >
          {message}
        </div>
      </div>
    </div>
  );
}
