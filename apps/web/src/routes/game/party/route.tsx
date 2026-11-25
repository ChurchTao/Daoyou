import { PartyWorkspace } from '@app/components/feature/party/PartyWorkspace';
import { GameSceneFrame } from '@app/components/game-shell';
import { useSearchParams } from 'react-router';

export default function PartyRoute() {
  const [query] = useSearchParams();
  const id = query.get('join');
  const source = new URLSearchParams(query);
  source.delete('join');
  const invite = id
    ? `/${encodeURIComponent(id)}/preview?${source}`
    : undefined;
  return (
    <GameSceneFrame
      variant="workflow"
      identityOverride={{ label: '组队', summary: '' }}
    >
      <div className="mx-auto max-w-lg">
        <PartyWorkspace invite={invite} />
      </div>
    </GameSceneFrame>
  );
}
