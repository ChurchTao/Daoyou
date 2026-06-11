import {
  CultivatorOverviewPanel,
  GameSceneFrame,
} from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';

export default function CultivatorPage() {
  const { cultivator, isLoading } = usePlayerStateView();

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">道友真形尚在凝聚……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚无角色资料，先去觉醒灵根，再来凝视真形。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            觉醒灵根
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  return (
    <GameSceneFrame>
      <CultivatorOverviewPanel />
    </GameSceneFrame>
  );
}
