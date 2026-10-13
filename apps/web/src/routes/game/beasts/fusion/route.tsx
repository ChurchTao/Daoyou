import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { useNavigate } from 'react-router';
import { FusionWorkspace } from './FusionWorkspace';

export default function BeastFusionPage() {
  const identity = useCultivatorIdentity();
  const navigate = useNavigate();
  const ownerId = identity.data?.cultivator?.id;
  return (
    <GameSceneFrame variant="workflow">
      {ownerId ? (
        <FusionWorkspace
          key={ownerId}
          ownerId={ownerId}
          closeLabel="返回灵兽袋"
          onClose={() => navigate('/game/beasts')}
          onViewResult={(beast, inBag) =>
            navigate(
              inBag
                ? `/game/beasts?beast=${beast.id}`
                : `/game/beasts/warehouse?beast=${beast.id}`,
            )
          }
        />
      ) : (
        <GameLoadingState variant="inline" message="正在准备融合……" />
      )}
    </GameSceneFrame>
  );
}
