import { RetreatView } from '@app/components/feature/retreat/RetreatView';
import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
} from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
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
import {
  describeSectFacilityStatus,
  STANDARD_SECT_PRESENTATION,
} from '@daoyou/game-rules/sect-organization';
import { Suspense, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.cultivation.retreat', renderer: CultivationConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.cultivation);

export default function SectCultivationRoomPage() {
  return (
    <SectPermissionBoundary
      permission="sect.facility.cultivation.use"
      sceneKey="cultivation"
    >
      <SectCultivationRoomBody />
    </SectPermissionBoundary>
  );
}

function SectCultivationRoomBody() {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  if (!context.data || !infrastructure.data)
    return <SectPageLoading sceneKey="cultivation" />;
  const effect = resolveSectBenefits(context.data, infrastructure.data)
    .facilityEffects.cultivation_room;
  const level = getSectBenefitMetric(effect, 'level', 1);
  const experienceBonusPercent =
    getSectBenefitMetric(effect, 'retreat_bonus') * 100;
  const scene = presentation.scenes.cultivation;
  if (searchParams.get('workspace') === 'retreat')
    return (
      <>
        <title>{formatDocumentTitle(scene.title)}</title>
        <Suspense fallback={<SectPageLoading sceneKey="cultivation" />}>
          <RetreatView
            sectContext={{
              facilityLevel: level,
              experienceBonusPercent,
              facilityLabel: presentation.facilityLabels.cultivation_room,
              scene,
              onExit: () =>
                navigate(
                  createSectRoomNpcHref(
                    '/game/sect/cultivation-room',
                    'keeper',
                  ),
                  { replace: true },
                ),
            }}
          />
        </Suspense>
      </>
    );
  return (
    <SectScene sceneKey="cultivation" mood="cultivation">
      <SectRoutedRoom
        roomKey="cultivation"
        registry={registry}
        eyebrow="聚灵阵枢 · 闭关名册"
      />
    </SectScene>
  );
}

function CultivationConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const presentation = getSectPresentationForContext(context.data);
  const navigate = useNavigate();
  const [showStatus, setShowStatus] = useState(false);
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: { context: context.data, infrastructure: infrastructure.data },
    perform: async () => undefined,
    onReset: () => setShowStatus(false),
  });
  const facility = infrastructure.data?.facilities.find(
    (candidate) => candidate.key === 'cultivation_room',
  );
  const effect =
    context.data && infrastructure.data
      ? resolveSectBenefits(context.data, infrastructure.data).facilityEffects
          .cultivation_room
      : undefined;
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (showStatus && facility)
    messages.push({
      id: 'status',
      speaker: actor.name,
      body: describeSectFacilityStatus({
        facilityLabel: presentation.facilityLabels.cultivation_room,
        facility,
        effect,
      })
        .map((segment) => segment.text)
        .join(''),
    });
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={[
        { id: 'status', label: '请执事说说此地阵效' },
        { id: 'workspace', label: '有劳执事为我启阵闭关' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      busy={session.phase === 'loading'}
      error={session.error ?? context.error ?? infrastructure.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'status') setShowStatus(true);
        else if (optionId === 'workspace')
          navigate(
            createSectRoomNpcHref(
              '/game/sect/cultivation-room?workspace=retreat',
              actor.roleKey,
            ),
          );
      }}
    />
  );
}
