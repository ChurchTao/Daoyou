import { InkButton } from '@app/components/ui/InkButton';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import type {
  BattlePlaybackRecordV3,
  PublicBattleUnitSnapshotV1,
} from '@shared/types/battle';
import { useNavigate } from 'react-router';
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
  const navigate = useNavigate();

  if (!battleResult) {
    return null;
  }

  const hasExitAction = statusActions?.some((action) =>
    /返回|离开|进入游戏/.test(action.label),
  );
  const resolvedStatusActions: BattleStatusAction[] = hasExitAction
    ? (statusActions ?? [])
    : [
        { label: '返回', onClick: () => navigate(-1) },
        ...(statusActions ?? []),
      ];
  const hasBattleFrames = Boolean(
    playback.currentPlayerFrame && playback.currentOpponentFrame,
  );

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
            statusActions={resolvedStatusActions}
          />
        )}

        <CombatActionLogV3
          sequences={battleResult.sequences}
          currentIndex={playback.currentIndex}
        />
      </div>

      {!hasBattleFrames ? (
        <div className="battle-dock fixed inset-x-0 bottom-0 z-40 select-none">
          <div className="mx-auto flex max-w-4xl items-center gap-3 pt-2 pr-[max(env(safe-area-inset-right),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
            {resolvedStatusActions.map((action) => (
              <InkButton
                key={action.label}
                variant="ghost"
                onClick={action.onClick}
                href={action.href}
                className="px-0 py-0 text-[13px] leading-5"
              >
                {action.label}
              </InkButton>
            ))}
          </div>
        </div>
      ) : null}

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
