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
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：播放/暂停 & 重播 */}
        <div className="flex gap-2">
          <InkButton 
            onClick={onToggle}
            variant="primary"
            // className="w-24 h-9"
          >
            {isPlaying ? '暂停' : '播放'}
          </InkButton>
          
          {onReset && (
            <InkButton 
              onClick={onReset}
              variant="outline"
              // className="w-20 h-9"
            >
              重播
            </InkButton>
          )}
        </div>

        {/* 中间：倍速 */}
        <div className="flex border border-ink-secondary rounded-sm overflow-hidden">
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

        {/* 右侧：跳过（暂留位） */}
        <div className="text-[10px] text-ink/40 italic">
          {progress >= 100 ? '战斗结束' : `播放中 (${Math.round(progress)}%)`}
        </div>
      </div>
    </div>
  );
}
