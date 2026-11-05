import { NpcConversation } from '@app/components/feature/room';
import type { SectRoomActorDefinition } from '@daoyou/game-rules/sect-organization';
import { createElement } from 'react';
import type { SectNpcConversationRegistry } from './SectNpcConversationRegistry';

export interface SectRoomConversationSelection {
  actor: SectRoomActorDefinition & { portrait?: string };
  onExit(): void;
}

export function SectRoomConversation({
  actor,
  registry,
  onExit,
}: SectRoomConversationSelection & { registry: SectNpcConversationRegistry }) {
  const renderer = registry.get(actor.conversation.renderer);
  if (renderer)
    return createElement(renderer, {
      key: actor.id,
      actor,
      parameters: actor.conversation.parameters ?? {},
      onExit,
    });

  console.error(`未注册宗门 NPC 会话展示器：${actor.conversation.renderer}`);
  return (
    <NpcConversation
      actor={actor}
      messages={[
        {
          id: 'missing-renderer',
          speaker: actor.name,
          body: '这项事务眼下还无法办理，请稍后再来。',
          tone: 'attention',
        },
      ]}
      options={[
        {
          id: 'leave',
          label: actor.appearance === 'facility' ? '返回房间' : '弟子告退',
          tone: 'muted',
        },
      ]}
      onSelectOption={onExit}
    />
  );
}
