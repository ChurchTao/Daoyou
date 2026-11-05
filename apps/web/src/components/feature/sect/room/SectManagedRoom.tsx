import { NpcConversation, RoomView } from '@app/components/feature/room';
import type { SectRoomDefinition } from '@daoyou/game-rules/sect-organization';
import { useMemo, useState } from 'react';
import type { SectNpcConversationRegistry } from './SectNpcConversationRegistry';
import { SectRoomConversation } from './SectRoomConversation';
import { getSectRoomPortrait } from './sectRoomPortrait';

export interface SectManagedRoomProps {
  roomKey: string;
  room?: SectRoomDefinition;
  registry: SectNpcConversationRegistry;
  eyebrow?: string;
  prompt?: string;
  selection?: {
    roleKey: string | undefined;
    onChange(roleKey: string | undefined): void;
  };
}

export function SectManagedRoom({
  room,
  registry,
  eyebrow,
  prompt,
  selection,
}: SectManagedRoomProps) {
  const [internalRoleKey, setInternalRoleKey] = useState<string>();
  const selectedRoleKey = selection ? selection.roleKey : internalRoleKey;
  const setSelectedRoleKey = selection
    ? selection.onChange
    : setInternalRoleKey;
  const actors = useMemo(
    () =>
      room?.actors.map((actor) => ({
        ...actor,
        portrait: getSectRoomPortrait(room.key, actor),
      })) ?? [],
    [room],
  );
  const selectedActor = actors.find(
    (actor) => actor.roleKey === selectedRoleKey,
  );

  if (!room)
    return (
      <NpcConversation
        actor={{
          sigil: '候',
          name: '当值弟子',
          identity: '当值弟子',
          responsibility: '负责接待来客。',
          portrait: 'icon:portrait-disciple-m',
        }}
        messages={[
          {
            id: 'missing-room',
            speaker: '当值弟子',
            body: '此处的经办人尚未到值，请稍后再来。',
            tone: 'attention',
          },
        ]}
      />
    );

  return (
    <RoomView
      eyebrow={eyebrow}
      description={room.description}
      actors={actors}
      selectedId={selectedActor?.id}
      onSelect={(actorId) => {
        const actor = room.actors.find((candidate) => candidate.id === actorId);
        if (actor) setSelectedRoleKey(actor.roleKey);
      }}
      prompt={
        prompt ??
        (room.actors.some((actor) => actor.appearance === 'facility')
          ? '点击人物或设施，查看详情'
          : '点击人物，与其交谈')
      }
      detail={
        selectedActor ? (
          <SectRoomConversation
            actor={selectedActor}
            registry={registry}
            onExit={() => setSelectedRoleKey(undefined)}
          />
        ) : undefined
      }
    />
  );
}
