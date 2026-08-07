import { useState, useEffect, useRef, useCallback } from 'react';
import type { TeamBattleRecord, TeamBattleFrame } from '@shared/engine/battle-team';

export interface PlaybackState {
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  currentFrame: TeamBattleFrame | null;
  progress: number;
}

/**
 * 战斗回放状态 hook。
 *
 * 注意：调用方应通过 `key` prop 在 record 变化时重新挂载组件，
 * 而非依赖此 hook 内部处理 record 变化。
 */
export function useTeamBattlePlayback(record: TeamBattleRecord): PlaybackState & {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  seek: (index: number) => void;
} {
  const frames = record.stateTimeline.frames;

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFrame = currentIndex >= 0 && currentIndex < frames.length
    ? frames[currentIndex]
    : frames[0] ?? null;

  const progress = frames.length > 0
    ? Math.min(1, Math.max(0, (currentIndex + 1) / frames.length))
    : 0;

  const play = useCallback(() => {
    setCurrentIndex((prev) => (prev >= frames.length - 1 ? 0 : prev));
    setIsPlaying(true);
  }, [frames.length]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const toggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(prev + 1, frames.length - 1));
  }, [frames.length]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, []);

  const seek = useCallback((index: number) => {
    setIsPlaying(false);
    setCurrentIndex(Math.min(Math.max(index, 0), frames.length - 1));
  }, [frames.length]);

  // 自动播放：timer 回调中 setState（异步，非同步 effect setState）
  useEffect(() => {
    if (!isPlaying) return;
    if (currentIndex >= frames.length - 1) {
      const id = setTimeout(() => setIsPlaying(false), 0);
      return () => clearTimeout(id);
    }
    const delay = 800 / speed;
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, frames.length - 1));
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, speed, frames.length]);

  return {
    currentIndex,
    isPlaying,
    speed,
    currentFrame,
    progress,
    play,
    pause,
    toggle,
    stepForward,
    stepBackward,
    reset,
    setSpeed,
    seek,
  };
}
