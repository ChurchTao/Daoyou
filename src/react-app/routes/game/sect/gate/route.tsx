import { StorySurfaceSlot } from '@app/components/feature/story/StorySurfaceSlot';
import {
  NpcConversation,
  useConversationSession,
  type NpcConversationMessage,
  type NpcConversationOption,
} from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import {
  useSectInfrastructureQuery,
  useSectTasksQuery,
} from '@app/components/feature/sect/sectResources';
import {
  createActivityImmersiveNavigationState,
  requestActivityImmersiveMode,
} from '@app/lib/gameActivityImmersive';
import { useStoryNpcDialogue } from '@app/lib/story/useStoryNpcDialogue';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';
import {
  resolveSweepActivityMode,
  sweepActivityMessage,
} from './sweep/sweepActivityState';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.gate.news', renderer: GateConversation },
  { key: 'sect.gate.sweep', renderer: GateSweepConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.gate);

export default function SectGatePage() {
  return (
    <SectPermissionBoundary permission="sect.gate.view" sceneKey="gate">
      <SectScene sceneKey="gate" mood="gate">
        <SectRoutedRoom
          roomKey="gate"
          registry={registry}
          eyebrow="山门值录 · 当日勤务"
        />
        <StorySurfaceSlot surface="sect.gate" />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function GateConversation({ actor, onExit }: SectNpcConversationRendererProps) {
  const infrastructure = useSectInfrastructureQuery();
  const storyDialogue = useStoryNpcDialogue('sect.gate', actor.name);
  const [showNews, setShowNews] = useState(false);
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: infrastructure.data,
    perform: async () => undefined,
    onReset: () => setShowNews(false),
  });
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', speaker: actor.name, body: actor.greeting },
  ];
  if (showNews)
    messages.push({
      id: 'news',
      speaker: actor.name,
      body: '今日山门内外无事，各处设施仍按常例修缮建设。',
    });
  messages.push(...storyDialogue.messages);
  const options: NpcConversationOption[] = [
    { id: 'news', label: '请执事说说今日山门动静' },
    ...storyDialogue.options,
    { id: 'leave', label: '弟子告退', tone: 'muted' },
  ];
  return (
    <NpcConversation
      actor={actor}
      messages={messages}
      options={options}
      busy={session.phase === 'loading' || storyDialogue.busy}
      error={storyDialogue.error ?? session.error ?? infrastructure.error}
      onSelectOption={(optionId) => {
        void (async () => {
          if (await storyDialogue.handleOption(optionId)) return;
          if (optionId === 'leave') onExit();
          else if (optionId === 'news') setShowNews(true);
        })();
      }}
    />
  );
}

function GateSweepConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const tasks = useSectTasksQuery();
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const session = useConversationSession({
    sessionKey: actor.id,
    snapshot: tasks.data,
    perform: async () => undefined,
    onReset: () => setEntering(false),
  });
  const mode = resolveSweepActivityMode(tasks.data);
  const messages: NpcConversationMessage[] = [
    { id: 'greeting', body: actor.greeting },
    { id: 'sweep', body: sweepActivityMessage(mode) },
  ];
  const options: NpcConversationOption[] = [
    {
      id: 'sweep',
      label: mode.kind === 'reward' ? '开始今日清扫' : '进入山门步道练习清扫',
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
      busy={session.phase === 'loading' || entering}
      error={session.error ?? tasks.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'sweep') {
          setEntering(true);
          void requestActivityImmersiveMode().then((result) =>
            navigate('/game/sect/gate/sweep', {
              state: createActivityImmersiveNavigationState(result),
            }),
          );
        }
      }}
    />
  );
}
