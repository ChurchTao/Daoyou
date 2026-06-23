import { BodyCultivationDetailPanel } from '@app/components/feature/cultivator/BodyCultivationPanels';
import { GameSceneFrame, GameSceneNote } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';

export default function BodyCultivationPage() {
  const { cultivator, isLoading, note } = usePlayerStateView();

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">正在读取炼体信息……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚无角色资料，先创建角色后再查看炼体。
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
      description="服用炼体丹提升皮肤、筋骨、脏腑、气血与元神五条轨道。满足等级、修为、材料和丹药要求后，可以提升肉身阶位。"
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
