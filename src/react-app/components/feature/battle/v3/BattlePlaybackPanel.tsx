import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import type {
  BattlePlaybackRecordV3,
  PublicBattleUnitSnapshotV1,
} from '@shared/types/battle';
import { CombatAttributeModal } from '../v5/CombatAttributeModal';
import { CombatControlBar } from '../v5/CombatControlBar';
import { CombatStatusHeader } from '../v5/CombatStatusHeader';
import { CombatActionLogV3 } from './CombatActionLog';
import type { BattlePlaybackStateV3 } from './useBattlePlaybackState';

export interface BattleStatusAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface BattlePlaybackPanelProps {
  battleResult: BattlePlaybackRecordV3 | undefined;
  playback: BattlePlaybackStateV3;
  statusActions?: BattleStatusAction[];
}

function hasExactAttributes(
  unit: PublicBattleUnitSnapshotV1 | null | undefined,
): unit is UnitStateSnapshot {
  return Boolean(unit && 'attrs' in unit && 'baseAttrs' in unit);
}

export function BattlePlaybackPanel({
  battleResult,
  playback,
  statusActions,
}: BattlePlaybackPanelProps) {
  if (!battleResult) {
    return null;
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3 md:gap-4">
        {playback.currentPlayerFrame && playback.currentOpponentFrame && (
          <CombatStatusHeader
            player={playback.currentPlayerFrame}
            opponent={playback.currentOpponentFrame}
            onShowPlayerDetails={
              hasExactAttributes(playback.currentPlayerFrame)
                ? () =>
                    playback.openUnitDetails(
                      playback.currentPlayerFrame ?? null,
                    )
                : undefined
            }
            onShowOpponentDetails={
              hasExactAttributes(playback.currentOpponentFrame)
                ? () =>
                    playback.openUnitDetails(
                      playback.currentOpponentFrame ?? null,
                    )
                : undefined
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
            statusActions={statusActions}
          />
        )}

        <CombatActionLogV3
          battleResult={battleResult}
          sequences={battleResult.sequences}
          currentIndex={playback.currentIndex}
          onInspect={playback.pause}
        />
      </div>

      <CombatAttributeModal
        unit={
          hasExactAttributes(playback.selectedUnit)
            ? playback.selectedUnit
            : null
        }
        isOpen={hasExactAttributes(playback.selectedUnit)}
        onClose={playback.closeUnitDetails}
      />
    </>
  );
}
