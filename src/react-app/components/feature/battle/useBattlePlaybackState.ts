import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import type { BattleRecord } from '@shared/types/battle';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useCombatPlayer } from './useCombatPlayer';

export { resolvePlaybackStateForRecord } from './useCombatPlayer';

export interface BattlePlaybackState {
  currentIndex: number;
  totalActions: number;
  progress: number;
  isPlaying: boolean;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  currentPlayerFrame: UnitStateSnapshot | undefined;
  currentOpponentFrame: UnitStateSnapshot | undefined;
  playerName: string;
  opponentName: string;
  isReplaySupported: boolean;
  isPlaybackFinished: boolean;
  selectedUnit: UnitStateSnapshot | null;
  setSelectedUnit: Dispatch<SetStateAction<UnitStateSnapshot | null>>;
}

export function isBattleReplaySupported(record: BattleRecord | undefined) {
  return !!record?.logSpans?.length && !!record?.stateTimeline?.frames?.length;
}

export function resolveBattleUnitName(
  record: BattleRecord | undefined,
  unitId: string | undefined,
  fallbackName: string,
) {
  if (!record || !unitId) {
    return fallbackName;
  }

  if (record.winner.id === unitId) {
    return record.winner.name;
  }

  if (record.loser.id === unitId) {
    return record.loser.name;
  }

  return fallbackName;
}

export function resolveBattlePlaybackNames(record: BattleRecord | undefined) {
  return {
    playerName: resolveBattleUnitName(record, record?.player, '加载中'),
    opponentName: resolveBattleUnitName(record, record?.opponent, '神秘对手'),
  };
}

export function useBattlePlaybackState(
  record: BattleRecord | undefined,
): BattlePlaybackState {
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(null);
  const {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    reset,
    totalActions,
    progress,
    unitSnapshots,
  } = useCombatPlayer(record);

  const replaySupported = isBattleReplaySupported(record);
  const { playerName, opponentName } = useMemo(
    () => resolveBattlePlaybackNames(record),
    [record],
  );

  useEffect(() => {
    if (record && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [currentIndex, isPlaying, play, record, totalActions]);

  useEffect(() => {
    setSelectedUnit(null);
  }, [record]);

  const currentPlayerFrame = record?.player ? unitSnapshots[record.player] : undefined;
  const currentOpponentFrame = record?.opponent
    ? unitSnapshots[record.opponent]
    : undefined;

  return {
    currentIndex,
    totalActions,
    progress,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    reset,
    currentPlayerFrame,
    currentOpponentFrame,
    playerName,
    opponentName,
    isReplaySupported: replaySupported,
    isPlaybackFinished:
      replaySupported && totalActions > 0 && currentIndex >= totalActions - 1,
    selectedUnit,
    setSelectedUnit,
  };
}
