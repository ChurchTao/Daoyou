import { ForgingRoom } from '@app/components/feature/forging/ForgingRoom';
import {
  SectFacilityWorkspaceConversation,
  SectNpcConversationRegistry,
  SectRoutedRoom,
} from '@app/components/feature/sect/room';
import {
  getSectPresentationForContext,
  useSectContextQuery,
  useSectInfrastructureQuery,
} from '@app/components/feature/sect/sectResources';
import { formatDocumentTitle } from '@app/lib/router/routeTitle';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { useSearchParams } from 'react-router';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.refinery.craft', renderer: SectFacilityWorkspaceConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.refinery);

export default function SectRefineryPage() {
  return (
    <SectPermissionBoundary
      permission="sect.facility.refinery.use"
      sceneKey="refinery"
    >
      <SectRefineryBody />
    </SectPermissionBoundary>
  );
}

function SectRefineryBody() {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const [searchParams] = useSearchParams();
  if (!context.data || !infrastructure.data)
    return <SectPageLoading sceneKey="refinery" />;
  const scene = presentation.scenes.refinery;
  if (searchParams.get('workspace') === 'craft')
    return (
      <>
        <title>{formatDocumentTitle(scene.title)}</title>
        <ForgingRoom />
      </>
    );
  return (
    <SectScene sceneKey="refinery" mood="refinery">
      <SectRoutedRoom
        roomKey="refinery"
        registry={registry}
        eyebrow="地火炉道 · 锻台封签"
      />
    </SectScene>
  );
}
