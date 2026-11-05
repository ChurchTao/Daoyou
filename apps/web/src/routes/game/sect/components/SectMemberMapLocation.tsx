import { getSectRoomPortrait } from '@app/components/feature/sect/room/sectRoomPortrait';
import type { SectRoomDefinition } from '@daoyou/game-rules/sect-organization';
import { lazy, type ReactNode } from 'react';
import { SectMapLocationPanel } from './SectMapLocationPanel';

const SectGateMapConversation = lazy(async () => ({
  default: (await import('../gate/route')).SectGateMapConversation,
}));
const SectAffairsMapConversation = lazy(async () => ({
  default: (await import('../affairs/components/SectAffairsRoom'))
    .SectAffairsMapConversation,
}));

export function SectMemberMapLocation({
  room,
  location,
}: {
  room: SectRoomDefinition;
  location: {
    spot: { label: string };
    description?: string;
    footer?: ReactNode;
    onClose(): void;
  };
}) {
  const actors = room.actors.map((actor) => ({
    ...actor,
    portrait: getSectRoomPortrait(room.key, actor),
  }));
  const Conversation =
    room.key === 'gate' ? SectGateMapConversation : SectAffairsMapConversation;

  return (
    <SectMapLocationPanel
      title={location.spot.label}
      description={location.description}
      footer={location.footer}
      actors={actors}
      onClose={location.onClose}
      renderConversation={(actorId, onExit) => {
        const actor = actors.find((candidate) => candidate.id === actorId);
        return actor ? <Conversation actor={actor} onExit={onExit} /> : null;
      }}
    />
  );
}
