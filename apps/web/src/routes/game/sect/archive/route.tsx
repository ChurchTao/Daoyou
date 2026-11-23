import { NpcConversation } from '@app/components/feature/room';
import { SectWorkspace } from '@app/components/feature/sect-v6/SectWorkspace';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { useStory } from '@app/lib/story/useStory';
import { MINE_LESSON_METHOD_LEVEL } from '@daoyou/game-domain/story';
import { STANDARD_SECT_PRESENTATION } from '@daoyou/game-rules/sect-organization';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromStudy =
    params.get('chapter') === 'mine-lesson' && params.get('beat') === 'study';
  const { story } = useStory(fromStudy);
  const nextAction =
    fromStudy && story?.chapterId === 'mine-lesson' && story.beatId === 'form'
      ? { href: story.href, label: '回演武处找教习' }
      : undefined;
  const studyTargetLevel =
    fromStudy &&
    story?.chapterId === 'mine-lesson' &&
    (story.beatId === 'study' || story.beatId === 'form')
      ? MINE_LESSON_METHOD_LEVEL
      : undefined;
  if (workspace)
    return (
      <SectWorkspace
        mode="methods"
        onExit={() => setWorkspace(false)}
        nextAction={nextAction}
        studyTargetLevel={studyTargetLevel}
      />
    );
  return (
    <NpcConversation
      actor={actor}
      messages={[{ id: 'greeting', speaker: actor.name, body: actor.greeting }]}
      options={[
        ...(nextAction ? [{ id: 'continue', label: nextAction.label }] : []),
        { id: 'workspace', label: '展开经卷研习' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      onSelectOption={(id) => {
        if (id === 'leave') onExit();
        else if (id === 'continue' && nextAction)
          void navigate(nextAction.href);
        else setWorkspace(true);
      }}
    />
  );
}
