import type { BattleRecord } from '@shared/types/battle';
import type { ReactNode } from 'react';
import type { BattlePlaybackState } from './useBattlePlaybackState';
import { CombatActionLog } from './v5/CombatActionLog';
import { CombatAttributeModal } from './v5/CombatAttributeModal';
import { CombatControlBar } from './v5/CombatControlBar';
import { CombatStatusHeader } from './v5/CombatStatusHeader';

export interface BattleStatusAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface BattlePlaybackPanelProps {
  battleResult: BattleRecord | undefined;
  playback: BattlePlaybackState;
  unsupportedNotice?: ReactNode;
  statusAction?: BattleStatusAction;
}

export function BattlePlaybackPanel({
  battleResult,
  playback,
  unsupportedNotice,
  statusAction,
}: BattlePlaybackPanelProps) {
  if (!battleResult) {
    return null;
  }

  return (
    <>
      {playback.isReplaySupported ? (
        <div className="flex h-full min-h-0 flex-col gap-3 md:gap-4">
          {playback.currentPlayerFrame && playback.currentOpponentFrame && (
            <CombatStatusHeader
              player={playback.currentPlayerFrame}
              opponent={playback.currentOpponentFrame}
              onShowPlayerDetails={() =>
                playback.openUnitDetails(playback.currentPlayerFrame ?? null)
              }
              onShowOpponentDetails={() =>
                playback.openUnitDetails(playback.currentOpponentFrame ?? null)
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
              statusAction={statusAction}
            />
          )}

          <CombatActionLog
            spans={battleResult.logSpans}
            currentIndex={playback.currentIndex}
          />
        </div>
      ) : unsupportedNotice ? (
        <div className="flex h-full items-center justify-center py-8">
          {unsupportedNotice}
        </div>
      ) : null}

      <CombatAttributeModal
        unit={playback.selectedUnit}
        isOpen={!!playback.selectedUnit}
        onClose={playback.closeUnitDetails}
      />
    </>
  );
}
