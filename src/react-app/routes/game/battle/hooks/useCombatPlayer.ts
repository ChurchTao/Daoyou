import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BattleRecord } from '@shared/types/battle';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';

type PlaybackState = {
  record: BattleRecord | undefined;
  currentIndex: number;
  isPlaying: boolean;
};

/**
 * useCombatPlayer
 *
 * 职责：管理战斗播放状态，并提供平滑的状态快照映射。
 */
export function useCombatPlayer(record: BattleRecord | undefined) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    record,
    currentIndex: -1,
    isPlaying: false,
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const spans = useMemo(() => record?.logSpans || [], [record]);
  const totalActions = spans.length;
  const currentRecordState =
    playbackState.record === record
      ? playbackState
      : { record, currentIndex: -1, isPlaying: false };
  const currentIndex = currentRecordState.currentIndex;
  const isEnded = currentIndex >= totalActions - 1 && totalActions > 0;
  const isPlaying = currentRecordState.isPlaying && totalActions > 0 && !isEnded;

  const latestUnitsBySpanId = useMemo(() => {
    const map = new Map<string, Record<string, UnitStateSnapshot>>();
    for (const frame of record?.stateTimeline.frames ?? []) {
      if (frame.sourceSpanId) {
        map.set(frame.sourceSpanId, frame.units);
      }
    }
    return map;
  }, [record]);

  const unitSnapshots = useMemo<Record<string, UnitStateSnapshot>>(() => {
    const initialUnits = record?.stateTimeline.frames[0]?.units;
    if (!record || !initialUnits) {
      return {};
    }

    let snapshots = initialUnits;
    for (let i = 0; i <= currentIndex; i++) {
      const span = spans[i];
      if (!span) {
        continue;
      }

      const latestUnits = latestUnitsBySpanId.get(span.id);
      if (latestUnits) {
        snapshots = { ...snapshots, ...latestUnits };
      }
    }

    return snapshots;
  }, [currentIndex, latestUnitsBySpanId, record, spans]);

  const next = useCallback(() => {
    if (totalActions <= 0) {
      return;
    }

    setPlaybackState((prev) => {
      const baseState =
        prev.record === record ? prev : { record, currentIndex: -1, isPlaying: false };
      return {
        record,
        currentIndex: Math.min(baseState.currentIndex + 1, totalActions - 1),
        isPlaying: baseState.isPlaying,
      };
    });
  }, [record, totalActions]);

  const pause = useCallback(() => {
    setPlaybackState((prev) => ({
      ...(prev.record === record
        ? prev
        : { record, currentIndex: -1, isPlaying: false }),
      isPlaying: false,
    }));
  }, [record]);

  const play = useCallback(() => {
    if (totalActions <= 0) {
      return;
    }

    setPlaybackState((prev) => {
      const baseState =
        prev.record === record ? prev : { record, currentIndex: -1, isPlaying: false };
      return {
        record,
        currentIndex:
          baseState.currentIndex >= totalActions - 1 ? -1 : baseState.currentIndex,
        isPlaying: true,
      };
    });
  }, [record, totalActions]);

  const reset = useCallback(() => {
    setPlaybackState({
      record,
      currentIndex: -1,
      isPlaying: false,
    });
  }, [record]);

  const skipToEnd = useCallback(() => {
    setPlaybackState({
      record,
      currentIndex: totalActions - 1,
      isPlaying: false,
    });
  }, [record, totalActions]);

  const jumpTo = useCallback((index: number) => {
    const safeIndex = Math.min(Math.max(-1, index), totalActions - 1);
    setPlaybackState({
      record,
      currentIndex: safeIndex,
      isPlaying: false,
    });
  }, [record, totalActions]);

  // 自动播放逻辑
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const delay = 1000 / playbackSpeed;
    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
  }, [currentIndex, isPlaying, playbackSpeed, next]);

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
    isEnded,
    progress: totalActions > 0 ? ((currentIndex + 1) / totalActions) * 100 : 0,
  };
}
