import { PaperSurface } from '@app/components/ui/PaperSurface';
import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';
import { GameTaskIndicator } from './GameTaskIndicator';

export function ImmersiveGameFrame({
  children,
  scrollContent = false,
  showTask = true,
  surface = 'scene',
}: {
  children: ReactNode;
  scrollContent?: boolean;
  showTask?: boolean;
  surface?: 'scene' | 'paper';
}) {
  const Frame = surface === 'paper' ? PaperSurface : 'div';
  return (
    <Frame
      className={cn(
        'flex h-full flex-col overflow-hidden',
        surface === 'scene' && 'bg-scene',
      )}
    >
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-x-hidden',
          scrollContent ? 'overflow-y-auto' : 'overflow-y-hidden',
        )}
      >
        {children}
      </div>
      {showTask ? (
        <div className="shrink-0 pt-2 pb-[env(safe-area-inset-bottom)] empty:hidden">
          <GameTaskIndicator />
        </div>
      ) : null}
    </Frame>
  );
}
