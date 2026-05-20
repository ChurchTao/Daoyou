import type { BattleRecord } from '@shared/types/battle';
import type { ReactNode } from 'react';
import { CombatActionLog } from './v5/CombatActionLog';
import { CombatAttributeModal } from './v5/CombatAttributeModal';
import { CombatControlBar } from './v5/CombatControlBar';
import { CombatStatusHeader } from './v5/CombatStatusHeader';
import type { BattlePlaybackState } from './useBattlePlaybackState';

interface BattlePlaybackPanelProps {
  battleResult: BattleRecord | undefined;
  playback: BattlePlaybackState;
  unsupportedNotice?: ReactNode;
}

export function BattlePlaybackPanel({
  battleResult,
  playback,
  unsupportedNotice,
}: BattlePlaybackPanelProps) {
  if (!battleResult) {
    return null;
  }

  return (
    <>
      {playback.isReplaySupported ? (
        <div className="mb-8 flex flex-col gap-4">
          {playback.currentPlayerFrame && playback.currentOpponentFrame && (
            <CombatStatusHeader
              player={playback.currentPlayerFrame}
              opponent={playback.currentOpponentFrame}
              onShowPlayerDetails={() =>
                playback.setSelectedUnit(playback.currentPlayerFrame ?? null)
              }
              onShowOpponentDetails={() =>
                playback.setSelectedUnit(playback.currentOpponentFrame ?? null)
              }
              controls={
                <CombatControlBar
                  isPlaying={playback.isPlaying}
                  playbackSpeed={playback.playbackSpeed}
                  progress={playback.progress}
                  onToggle={() =>
                    playback.isPlaying ? playback.pause() : playback.play()
                  }
                  onSpeedChange={playback.setPlaybackSpeed}
                  onReset={playback.reset}
                />
              }
            />
          )}

          <CombatActionLog
            spans={battleResult.logSpans}
            currentIndex={playback.currentIndex}
          />
        </div>
      ) : (
        unsupportedNotice ? <div className="mb-8">{unsupportedNotice}</div> : null
      )}

      <CombatAttributeModal
        unit={playback.selectedUnit}
        isOpen={!!playback.selectedUnit}
        onClose={() => playback.setSelectedUnit(null)}
      />
    </>
  );
}
