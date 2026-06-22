import { BodyCultivationDetailPanel } from '@app/components/feature/cultivator/BodyCultivationPanels';
import { GameSceneFrame, GameSceneNote } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';

export default function BodyCultivationPage() {
  const { cultivator, isLoading, note } = usePlayerStateView();

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">肉身气血尚在归位……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚无角色资料，先去觉醒灵根，再来淬炼肉身。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            觉醒灵根
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  return (
    <GameSceneFrame
      title="肉身炼体"
      description="以炼体丹滋养皮肤、筋骨、脏腑、气血与元神，积厚根基，再备齐资粮冲开下一重肉身。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
    >
      <BodyCultivationDetailPanel />
    </GameSceneFrame>
  );
}
