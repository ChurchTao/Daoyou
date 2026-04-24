'use client';

import { cn } from '@/lib/cn';

interface CombatControlBarProps {
  isPlaying: boolean;
  playbackSpeed: number;
  progress: number;
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onReset?: () => void;
}

export function CombatControlBar({
  isPlaying,
  playbackSpeed,
  progress,
  onToggle,
  onSpeedChange,
  onReset,
}: CombatControlBarProps) {
  const speeds = [0.5, 1.0, 1.5, 2.0];
  const isFinished = progress >= 100;
  const mainActionLabel =
    onReset && isFinished ? '重播' : isPlaying ? '暂停' : '播放';
  const mainAction = onReset && isFinished ? onReset : onToggle;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={mainAction}
          className={cn(
            'transition-colors',
            isPlaying && !isFinished
              ? 'text-crimson'
              : 'text-battle-muted hover:text-ink',
          )}
        >
          [{mainActionLabel}]
        </button>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-battle-muted">速度</span>
          {speeds.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => onSpeedChange(speed)}
              className={cn(
                'text-sm transition-colors',
                playbackSpeed === speed
                  ? 'text-ink font-medium'
                  : 'text-battle-muted hover:text-ink',
              )}
            >
              [{speed.toFixed(1)}x]
            </button>
          ))}
        </div>
      </div>

      <p className="text-battle-muted shrink-0">
        {isFinished ? '已结束' : isPlaying ? '播放中' : '已暂停'}
      </p>
    </div>
  );
}
