import {
  AlchemyCraftSessionProvider,
  FurnaceWorkspace,
} from '@app/components/feature/alchemy';
import {
  SectFacilityWorkspaceConversation,
  SectNpcConversationRegistry,
  SectRoutedRoom,
} from '@app/components/feature/sect/room';
import {
  getSectPresentationForContext,
  resolveSectBenefits,
  useSectContextQuery,
  useSectInfrastructureQuery,
} from '@app/components/feature/sect/sectResources';
import { createSectRoomNpcHref } from '@app/components/feature/sect/sectRoomNavigation';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { getSectBenefitMetric } from '@app/lib/sect/sectPresentation';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { useNavigate, useSearchParams } from 'react-router';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.alchemy.craft', renderer: SectFacilityWorkspaceConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.alchemy);

export default function SectAlchemyPage() {
  return (
    <SectPermissionBoundary
      permission="sect.facility.alchemy.use"
      sceneKey="alchemy"
    >
      <SectAlchemyBody />
    </SectPermissionBoundary>
  );
}

function SectAlchemyBody() {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  if (!context.data || !infrastructure.data)
    return <SectPageLoading sceneKey="alchemy" />;
  const effect = resolveSectBenefits(context.data, infrastructure.data)
    .facilityEffects.alchemy;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const discountPercent = getSectBenefitMetric(effect, 'discount') * 100;
  const scene = presentation.scenes.alchemy;
  if (searchParams.get('workspace') === 'craft')
    return (
      <>
        <title>{formatDocumentTitle(scene.title)}</title>
        <SectScene sceneKey="alchemy" mood="alchemy">
          <AlchemyCraftSessionProvider
            sectContext={{
              facilityLevel: level,
              discountPercent,
              facilityLabel:
                presentation.facilityLabels.alchemy ??
                presentation.facilityLabels.workshop,
              scene,
            }}
          >
            <FurnaceWorkspace
              onBack={() =>
                navigate(
                  createSectRoomNpcHref('/game/sect/alchemy', 'furnace'),
                  { replace: true },
                )
              }
              onReturn={() =>
                navigate('/game/sect/alchemy', { replace: true })
              }
            />
          </AlchemyCraftSessionProvider>
        </SectScene>
      </>
    );
  return (
    <SectScene sceneKey="alchemy" mood="alchemy">
      <SectRoutedRoom
        roomKey="alchemy"
        registry={registry}
        eyebrow="丹炉火候 · 药柜封签"
      />
    </SectScene>
  );
}
