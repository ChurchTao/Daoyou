'use client';

import { InkButton } from '@/components/ui/InkButton';
import { cn } from '@/lib/cn';

interface CombatControlBarProps {
  isPlaying: boolean;
  playbackSpeed: number;
  progress: number;
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onReset?: () => void;
}

/**
 * 战斗播放控制栏
 */
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

  return (
    <div className="mt-4 p-3 border-t border-dashed border-ink-secondary flex flex-col gap-3 select-none">
      {/* 进度条 */}
      <div className="relative h-1 bg-ink/10 w-full rounded-full overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full bg-ink transition-all duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-between gap-2">
        {/* 左侧：主操作按钮 (播放/暂停 或 结束后的重播) */}
        <div className="flex">
          {!isFinished ? (
            <InkButton 
              onClick={onToggle}
              variant="primary"
            >
              {isPlaying ? '暂停' : '播放'}
            </InkButton>
          ) : (
            onReset && (
              <InkButton 
                onClick={onReset}
                variant="outline"
              >
                重播
              </InkButton>
            )
          )}
        </div>

        {/* 中间：倍速 (仅在未结束或需要调整时显示) */}
        <div className="flex border border-ink-secondary rounded-sm overflow-hidden bg-white/50">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={cn(
                "px-2 py-1 text-xs transition-colors",
                playbackSpeed === s 
                  ? "bg-ink text-paper" 
                  : "bg-transparent text-ink hover:bg-ink/5"
              )}
            >
              {s.toFixed(1)}x
            </button>
          ))}
        </div>

        {/* 右侧：状态文本 */}
        <div className="text-xs text-ink/40 italic text-right">
          {isFinished ? '已结束' : `${Math.round(progress)}%`}
        </div>
      </div>
    </div>
  );
}
