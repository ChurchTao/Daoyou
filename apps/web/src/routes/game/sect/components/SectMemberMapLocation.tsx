import { MapLocationDrawer } from '@app/components/feature/map/MapLocationDrawer';
import { getSectRoomPortrait } from '@app/components/feature/sect/room/sectRoomPortrait';
import { storyPassageActor } from '@app/components/feature/story/storyPassageActor';
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
  const castName = entry?.cast
    ? storyPerformanceContext({ name: '' }, sectId)[entry.cast]
    : undefined;
  const passage = story?.passage && getMapPassage(story.passage.id);
  const passageActor = passage && storyPassageActor(passage);
  const actor = entry
    ? {
        id: entry.id,
        name: castName ?? entry.name,
        portrait: entry.cast
          ? storyCastFace(`{${entry.cast}}`, sectId)
          : undefined,
        sigil: entry.kind === 'facility' ? 'icon:map-landmark' : '人',
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
    ...(passageActor ? [passageActor] : []),
  ];
  const Conversation =
    room?.key === 'gate' ? SectGateMapConversation : SectAffairsMapConversation;

  return (
    <MapLocationDrawer
      title={location.spot.label}
      description={location.description}
      footer={location.footer}
      actors={actors}
      onClose={location.onClose}
      onActivate={(id) => {
        if (entry?.id !== id || !story?.playHref) return false;
        void navigate(story.playHref);
        return true;
      }}
      renderConversation={(actorId, onExit) => {
        if (story && passage && actorId === passageActor?.id)
          return <StoryPassageDetail story={story} passage={passage} />;
        const actor = roomActors.find((candidate) => candidate.id === actorId);
        return actor ? <Conversation actor={actor} onExit={onExit} /> : null;
      }}
    />
  );
}
