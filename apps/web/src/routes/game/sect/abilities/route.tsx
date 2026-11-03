import { NpcConversation } from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  SectTaskLocationConversation,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { STANDARD_SECT_PRESENTATION } from '@daoyou/game-rules/sect-organization';
import { useNavigate } from 'react-router';
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
          body: '心法与经脉决定神通。已经学会的效果，记在角色的宗门心法里。',
        },
      ]}
      options={[
        { id: 'workspace', label: '查看宗门心法' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      onSelectOption={(id) => {
        if (id === 'leave') onExit();
        else navigate('/game/cultivator?tab=sect');
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
