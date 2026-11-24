import { MapLocationDrawer } from '@app/components/feature/map/MapLocationDrawer';
import { getSectRoomPortrait } from '@app/components/feature/sect/room/sectRoomPortrait';
import { StoryPassageDetail } from '@app/components/feature/story/StoryPassageDetail';
import {
  storyCastFace,
  storyPerformanceContext,
} from '@app/lib/story/performanceContext';
import {
  getMapPassage,
  getSectStoryEntry,
} from '@daoyou/game-content/world/map';
import type { StoryView } from '@daoyou/game-domain/story';
import type { SectRoomDefinition } from '@daoyou/game-rules/sect-organization';
import { lazy, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

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
  story,
  sectId,
}: {
  room?: SectRoomDefinition;
  story?: StoryView;
  sectId: string;
  location: {
    spot: { id: string; label: string };
    description?: string;
    footer?: ReactNode;
    onClose(): void;
  };
}) {
  const navigate = useNavigate();
  const roomActors =
    room?.actors.map((actor) => ({
      ...actor,
      portrait: getSectRoomPortrait(room.key, actor),
    })) ?? [];
  const entry =
    story?.entry && getSectStoryEntry(location.spot.id, story.entry);
  const resident = roomActors.find(({ roleKey }) => roleKey === entry?.id);
  const castName = entry?.cast
    ? storyPerformanceContext({ name: '' }, sectId)[entry.cast]
    : undefined;
  const passage = story?.passage && getMapPassage(story.passage.id);
  const actor = entry
    ? {
        id: resident?.id ?? entry.id,
        name: resident?.name ?? castName ?? entry.name,
        portrait:
          resident?.portrait ??
          (entry.cast ? storyCastFace(`{${entry.cast}}`, sectId) : undefined),
        sigil:
          resident?.sigil ??
          (entry.kind === 'facility' ? 'icon:map-landmark' : '人'),
        identity: story.actionLabel ?? story.prompt,
        responsibility: '',
        status: { label: '主线' },
        ...(entry.kind === 'facility'
          ? { appearance: 'facility' as const }
          : {}),
      }
    : undefined;
  const actors = [
    ...roomActors.filter(({ id }) => id !== actor?.id),
    ...(actor ? [actor] : []),
  ];
  const Conversation =
    room?.key === 'gate' ? SectGateMapConversation : SectAffairsMapConversation;

  return (
    <MapLocationDrawer
      title={location.spot.label}
      description={location.description}
      footer={
        story && passage ? (
          <div className="space-y-4">
            <StoryPassageDetail story={story} passage={passage} />
            {location.footer}
          </div>
        ) : (
          location.footer
        )
      }
      actors={actors}
      onClose={location.onClose}
      onActivate={(id) => {
        if (actor?.id !== id || !story?.playHref) return false;
        void navigate(story.playHref);
        return true;
      }}
      renderConversation={(actorId, onExit) => {
        const actor = roomActors.find((candidate) => candidate.id === actorId);
        return actor ? <Conversation actor={actor} onExit={onExit} /> : null;
      }}
    />
  );
}
