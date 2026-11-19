import { cn } from '@app/lib/cn';
import type { ReactNode } from 'react';
import { GameTaskIndicator } from './GameTaskIndicator';

export function ImmersiveGameFrame({
  children,
  scrollContent = false,
  showTask = true,
}: {
  children: ReactNode;
  scrollContent?: boolean;
  showTask?: boolean;
}) {
  return (
    <div className="bg-scene flex h-full flex-col overflow-hidden">
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
    </div>
  );
}
