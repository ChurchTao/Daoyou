'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BattleRecord } from '@/lib/services/battleResult';
import type { LogSpan } from '@/engine/battle-v5/systems/log/types';

/**
 * useCombatPlayer
 * 
 * 职责：管理战斗播放状态（索引、播放/暂停、速度）。
 * 进度粒度：动作帧 (LogSpan)。
 */
export function useCombatPlayer(record: BattleRecord | undefined) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const spans = useMemo(() => record?.logSpans || [], [record]);
  const totalActions = spans.length;

  const next = useCallback(() => {
    setCurrentIndex((prev) => (prev < totalActions - 1 ? prev + 1 : prev));
  }, [totalActions]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const play = useCallback(() => setIsPlaying(true), []);
  const jumpTo = useCallback((index: number) => {
    setIsPlaying(false);
    setCurrentIndex(Math.min(Math.max(-1, index), totalActions - 1));
  }, [totalActions]);

  // 自动播放逻辑
  useEffect(() => {
    if (!isPlaying || currentIndex >= totalActions - 1) {
      if (currentIndex >= totalActions - 1) {
        setIsPlaying(false);
      }
      return;
    }

    const delay = 1000 / playbackSpeed;
    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, totalActions, playbackSpeed, next]);

  // 获取当前动作及其关联的状态帧
  const currentSpan = useMemo<LogSpan | undefined>(() => {
    if (currentIndex < 0) return undefined;
    return spans[currentIndex];
  }, [spans, currentIndex]);

  const currentFrames = useMemo(() => {
    if (!record || currentIndex < 0) return [];
    const spanId = spans[currentIndex].id;
    return record.stateTimeline.frames.filter((f) => f.sourceSpanId === spanId);
  }, [record, currentIndex, spans]);

  return {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    jumpTo,
    currentSpan,
    currentFrames,
    totalActions,
    isEnded: currentIndex >= totalActions - 1 && totalActions > 0,
    progress: totalActions > 0 ? ((currentIndex + 1) / totalActions) * 100 : 0,
  };
}
