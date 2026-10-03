import {
  CultivatorOverviewPanel,
  GameSceneFrame,
  GameSceneLoading,
} from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { useCultivatorIdentity } from '@app/lib/resources/player';

export default function CultivatorPage() {
  const profile = useCultivatorIdentity();
  const cultivator = profile.data?.cultivator;
  const isLoading = profile.loading;

  if (isLoading && !cultivator) {
    return <GameSceneLoading message="道友真形尚在凝聚……" />;
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
