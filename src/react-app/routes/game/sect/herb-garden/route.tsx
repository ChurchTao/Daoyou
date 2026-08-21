import { StorySurfaceSlot } from '@app/components/feature/story/StorySurfaceSlot';
import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
} from '@app/components/feature/room';
import {
  SectFacilityStatusConversation,
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { useSectInfrastructureQuery } from '@app/components/feature/sect/sectResources';
import { useStoryNpcDialogue } from '@app/lib/story/useStoryNpcDialogue';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  {
    key: 'sect.herb-garden.status',
    renderer: SectFacilityStatusConversation,
  },
  {
    key: 'sect.herb-garden.caretaker',
    renderer: HerbGardenCaretakerConversation,
  },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.herbGarden);

export default function SectHerbGardenPage() {
  return (
    <SectPermissionBoundary
      permission="sect.herb_garden.view"
      sceneKey="herbGarden"
    >
      <SectScene sceneKey="herbGarden" mood="garden">
        <SectRoutedRoom
          roomKey="herbGarden"
          registry={registry}
          eyebrow="药畦晨露 · 草木值录"
        />
        <StorySurfaceSlot surface="sect.herb-garden" />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function readText(
  parameters: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = parameters[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function HerbGardenCaretakerConversation({
  actor,
  parameters,
  onExit,
}: SectNpcConversationRendererProps) {
  const infrastructure = useSectInfrastructureQuery();
  const storyDialogue = useStoryNpcDialogue('sect.herb-garden', actor.name);
  const facilityKey = readText(parameters, 'facilityKey');
  const detail = readText(parameters, 'detail');
  const stages = Array.isArray(parameters.stages)
    ? parameters.stages.filter(
        (stage): stage is string =>
          typeof stage === 'string' && Boolean(stage.trim()),
      )
    : [];
  const facility = facilityKey
    ? infrastructure.data?.facilities.find(
        (candidate) => candidate.key === facilityKey,
      )
    : undefined;
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: infrastructure.data,
    perform: async () => undefined,
  });
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (facility && stages.length)
    messages.push({
      id: 'growth',
      speaker: actor.name,
      body: `眼下正是“${stages[Math.min(stages.length - 1, Math.max(0, facility.level - 1))]}”的长势。${detail ?? ''}`,
    });
  else if (!infrastructure.loading)
    messages.push({
      id: 'missing-growth',
      speaker: actor.name,
      body: detail ?? '今日田间值录尚未归档，请稍后再来。',
      tone: facility ? 'normal' : 'attention',
    });

  messages.push(...storyDialogue.messages);

  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={[
        ...storyDialogue.options,
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      busy={
        session.phase === 'loading' || infrastructure.loading || storyDialogue.busy
      }
      error={storyDialogue.error ?? session.error ?? infrastructure.error}
      onSelectOption={(optionId) => {
        void (async () => {
          if (await storyDialogue.handleOption(optionId)) return;
          if (optionId === 'leave') onExit();
        })();
      }}
    />
  );
}
