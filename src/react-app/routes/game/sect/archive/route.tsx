import { NpcConversation } from '@app/components/feature/room';
import { SectWorkspace } from '@app/components/feature/sect-v6/SectWorkspace';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { useState } from 'react';
import { SectPermissionBoundary, SectScene } from '../components/SectScene';

const registry = new SectNpcConversationRegistry([
  { key: 'sect.archive.methods', renderer: Conversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.archive);

export default function Page() {
  return (
    <SectPermissionBoundary permission="sect.archive.use" sceneKey="archive">
      <SectScene sceneKey="archive" mood="archive">
        <SectRoutedRoom roomKey="archive" registry={registry} />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function Conversation({ actor, onExit }: SectNpcConversationRendererProps) {
  const [workspace, setWorkspace] = useState(false);
  if (workspace)
    return <SectWorkspace mode="methods" onExit={() => setWorkspace(false)} />;
  return (
    <NpcConversation
      actor={actor}
      messages={[{ id: 'greeting', speaker: actor.name, body: actor.greeting }]}
      options={[
        { id: 'workspace', label: '展开经卷研习' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      onSelectOption={(id) => {
        if (id === 'leave') onExit();
        else setWorkspace(true);
      }}
    />
  );
}
