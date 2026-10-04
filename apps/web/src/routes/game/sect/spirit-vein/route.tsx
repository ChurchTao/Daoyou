import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
  type NpcConversationOption,
} from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  SectTaskLocationConversation,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import {
  getSectPresentationForContext,
  resolveSectBenefits,
  useSectContextQuery,
  useSectInfrastructureQuery,
  useSectTasksQuery,
} from '@app/components/feature/sect/sectResources';
import {
  createActivityImmersiveNavigationState,
  requestActivityImmersiveMode,
} from '@app/lib/gameActivityImmersive';
import {
  describeSectFacilityStatus,
  STANDARD_SECT_PRESENTATION,
} from '@daoyou/game-rules/sect-organization';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';
import {
  miningActivityMessage,
  resolveMiningActivityMode,
} from './mining/miningActivityState';

const registry = new SectNpcConversationRegistry([
  {
    key: 'sect.spirit-vein.mining',
    renderer: SpiritVeinFacilityConversation,
  },
  {
    key: 'sect.spirit-vein.patrol',
    renderer: SectTaskLocationConversation,
  },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.spiritVein);

export default function SectSpiritVeinPage() {
  return (
    <SectPermissionBoundary
      permission="sect.spirit_vein.view"
      sceneKey="spiritVein"
    >
      <SectScene sceneKey="spiritVein" mood="vein">
        <SectRoutedRoom
          roomKey="spiritVein"
          registry={registry}
          eyebrow="矿场井口 · 脉息封签"
        />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function SpiritVeinFacilityConversation({
  actor,
  parameters,
  onExit,
}: SectNpcConversationRendererProps) {
  const context = useSectContextQuery();
  const infrastructure = useSectInfrastructureQuery();
  const tasks = useSectTasksQuery();
  const presentation = getSectPresentationForContext(context.data);
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const mode = resolveMiningActivityMode(tasks.data);
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: {
      context: context.data,
      infrastructure: infrastructure.data,
      tasks: tasks.data,
    },
    perform: async () => undefined,
    onReset: () => setEntering(false),
  });
  const facilityKey =
    typeof parameters.facilityKey === 'string'
      ? parameters.facilityKey
      : 'spirit_vein';
  const facility = infrastructure.data?.facilities.find(
    (candidate) => candidate.key === facilityKey,
  );
  const effect =
    context.data && infrastructure.data
      ? resolveSectBenefits(context.data, infrastructure.data).facilityEffects[
          'spirit_vein'
        ]
      : undefined;
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', body: actor.greeting },
  ];
  if (facility)
    messages.push({
      id: 'status',
      body: describeSectFacilityStatus({
        facilityLabel: presentation.facilityLabels[facilityKey] ?? actor.name,
        facility,
        effect,
      })
        .map((segment) => segment.text)
        .join(''),
    });
  messages.push({ id: 'mining', body: miningActivityMessage(mode) });
  const options: NpcConversationOption[] = [
    {
      id: 'mining',
      label: mode.kind === 'reward' ? '开始今日灵矿采掘' : '进入矿脉自由练习',
      tone: mode.kind === 'reward' ? 'primary' : 'normal',
      disabled: entering,
    },
    { id: 'leave', label: '返回房间', tone: 'muted' },
  ];
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={options}
      busy={
        session.phase === 'loading' ||
        entering ||
        context.loading ||
        infrastructure.loading ||
        tasks.loading
      }
      error={
        session.error ?? context.error ?? infrastructure.error ?? tasks.error
      }
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'mining') {
          setEntering(true);
          void requestActivityImmersiveMode().then((result) =>
            navigate('/game/sect/spirit-vein/mining', {
              state: createActivityImmersiveNavigationState(result),
            }),
          );
        }
      }}
    />
  );
}
