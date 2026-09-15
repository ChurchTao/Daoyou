import { NpcConversation } from '@app/components/feature/room';
import { SectWorkspace } from '@app/components/feature/sect-v6/SectWorkspace';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  SectTaskLocationConversation,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { createSectRoomNpcHref } from '@app/components/feature/sect/sectRoomNavigation';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { useNavigate, useSearchParams } from 'react-router';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';

export default function SectAbilitiesPage() {
  return (
    <SectPermissionBoundary permission="sect.arena.use" sceneKey="arena">
      <SectArenaBody />
    </SectPermissionBoundary>
  );
}

const arenaRegistry = new SectNpcConversationRegistry([
  { key: 'sect.arena.loadout', renderer: ArenaInstructorConversation },
  { key: 'sect.arena.marshal', renderer: ArenaMarshalConversation },
  { key: 'sect.arena.tournament', renderer: SectTaskLocationConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.arena);

function SectArenaBody() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('workspace') === 'loadout') return <SectAbilitiesBody />;
  return (
    <SectScene sceneKey="arena" mood="arena">
      <SectRoutedRoom
        roomKey="arena"
        registry={arenaRegistry}
        eyebrow="演武阵台 · 神通校验"
      />
    </SectScene>
  );
}

function ArenaInstructorConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const navigate = useNavigate();
  return (
    <NpcConversation
      actor={actor}
      messages={[
        {
          id: 'greeting',
          speaker: actor.name,
          body: '心法与经脉决定神通，已解锁的神通会自动用于战斗。可在此查阅当前效果。',
        },
      ]}
      options={[
        { id: 'workspace', label: '查阅宗门神通' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      onSelectOption={(id) => {
        if (id === 'leave') onExit();
        else
          navigate(
            createSectRoomNpcHref(
              '/game/sect/arena?workspace=loadout',
              actor.roleKey,
            ),
          );
      }}
    />
  );
}

function ArenaMarshalConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  return (
    <NpcConversation
      actor={actor}
      messages={[
        { id: 'greeting', speaker: actor.name, body: actor.greeting },
        {
          id: 'ring',
          speaker: actor.name,
          body: '若已接下宗门小比，去场中的宗门擂台核对对手名录即可。',
        },
      ]}
      options={[{ id: 'leave', label: '弟子告退', tone: 'muted' }]}
      onSelectOption={onExit}
    />
  );
}

function SectAbilitiesBody() {
  const navigate = useNavigate();
  return (
    <SectScene sceneKey="arena" mood="arena">
      <SectWorkspace
        mode="skills"
        onExit={() => navigate('/game/sect/arena')}
      />
    </SectScene>
  );
}
