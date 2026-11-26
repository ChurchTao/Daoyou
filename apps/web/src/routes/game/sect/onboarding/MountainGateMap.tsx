import { MapLocationDrawer } from '@app/components/feature/map/MapLocationDrawer';
import { SectMap } from '@app/components/feature/sect/SectMap';
import { ImmersiveGameFrame } from '@app/components/game-shell/ImmersiveGameFrame';
import { InkButton } from '@app/components/ui';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { useNavigate } from 'react-router';

export function MountainGateMap({
  sectId,
  sectName,
  backHref,
  choicesHref,
  playHref,
}: {
  sectId: string;
  sectName: string;
  backHref: string;
  choicesHref: string;
  playHref: string;
}) {
  const navigate = useNavigate();
  const { map, rooms, scenes } = getSectPresentation(sectId);
  const title = sectName + ' · 山门到访';

  return (
    <div className="h-dvh">
      <title>{formatDocumentTitle(title)}</title>
      <ImmersiveGameFrame showTask={false}>
        <SectMap
          title={title}
          backAction={{
            label: '回接引亭',
            onBack: () => navigate(backHref, { replace: true }),
          }}
          mode="visitor"
          image={map.image}
          alt={map.alt}
          aspectRatio={map.aspectRatio}
          hotspots={map.hotspots}
          rooms={rooms}
          scenes={scenes}
          storySpotId="gate"
          initialSelectedId="gate"
          renderLocation={({ spot, description, onClose }) =>
            spot.id === 'gate' ? (
              <MapLocationDrawer
                title={spot.label}
                description={description}
                onClose={onClose}
                actors={[
                  {
                    id: 'gate-guide',
                    name: '山门接引弟子',
                    sigil: '人',
                    identity: '出示路帖，看看这家山门',
                    responsibility: '',
                  },
                ]}
                onActivate={() => {
                  void navigate(playHref, { replace: true });
                  return true;
                }}
                renderConversation={() => null}
                footer={<InkButton href={choicesHref}>看看别家山门</InkButton>}
              />
            ) : null
          }
        />
      </ImmersiveGameFrame>
    </div>
  );
}
