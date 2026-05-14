'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BattleRecord } from '@/lib/services/battleResult';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';

/**
 * useCombatPlayer
 * 
 * 职责：管理战斗播放状态，并提供平滑的状态快照映射。
 */
export function useCombatPlayer(record: BattleRecord | undefined) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const spans = useMemo(() => record?.logSpans || [], [record]);
  const totalActions = spans.length;

  // 记录上一次显示的快照，防止状态回滚/闪烁
  const [unitSnapshots, setUnitSnapshots] = useState<Record<string, UnitStateSnapshot>>({});

  // 初始化快照
  useEffect(() => {
    if (record?.stateTimeline.frames[0]) {
      setUnitSnapshots(record.stateTimeline.frames[0].units);
      setCurrentIndex(-1);
    }
  }, [record]);

  const next = useCallback(() => {
    setCurrentIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx >= totalActions) return prev;

      // 更新快照：查找该动作产生的所有状态帧，取最后一帧更新到当前显示
      if (record) {
        const spanId = spans[nextIdx].id;
        const frames = record.stateTimeline.frames.filter(f => f.sourceSpanId === spanId);
        if (frames.length > 0) {
          const lastFrame = frames[frames.length - 1];
          setUnitSnapshots(prevSnaps => ({
            ...prevSnaps,
            ...lastFrame.units
          }));
        }
      }

      return nextIdx;
    });
  }, [totalActions, record, spans]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const play = useCallback(() => setIsPlaying(true), []);
  
  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(-1);
    if (record?.stateTimeline.frames[0]) {
      setUnitSnapshots(record.stateTimeline.frames[0].units);
    }
  }, [record]);

  const skipToEnd = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(totalActions - 1);
    // 取最后一帧状态
    if (record && record.stateTimeline.frames.length > 0) {
      setUnitSnapshots(record.stateTimeline.frames[record.stateTimeline.frames.length - 1].units);
    }
  }, [record, totalActions]);

  const jumpTo = useCallback((index: number) => {
    setIsPlaying(false);
    const safeIndex = Math.min(Math.max(-1, index), totalActions - 1);
    setCurrentIndex(safeIndex);
    
    // 重新计算状态：从头累加到目标索引
    if (record) {
      let snaps = record.stateTimeline.frames[0].units;
      for (let i = 0; i <= safeIndex; i++) {
        const spanId = spans[i].id;
        const frames = record.stateTimeline.frames.filter(f => f.sourceSpanId === spanId);
        if (frames.length > 0) {
          snaps = { ...snaps, ...frames[frames.length - 1].units };
        }
      }
      setUnitSnapshots(snaps);
    }
  }, [record, spans, totalActions]);

  // 自动播放逻辑
  useEffect(() => {
    if (!isPlaying || currentIndex >= totalActions - 1) {
      if (currentIndex >= totalActions - 1 && totalActions > 0) {
        setIsPlaying(false);
      }
      return;
    }

    const delay = 1000 / playbackSpeed;
    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, totalActions, playbackSpeed, next]);

  return {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    reset,
    skipToEnd,
    jumpTo,
    unitSnapshots,
    totalActions,
    isEnded: currentIndex >= totalActions - 1 && totalActions > 0,
    progress: totalActions > 0 ? ((currentIndex + 1) / totalActions) * 100 : 0,
  };
}

