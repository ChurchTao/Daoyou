import type { RoomActorView } from '@app/components/feature/room';
import type { MapPassage } from '@daoyou/game-domain/world/map';

export function storyPassageActor(passage: MapPassage): RoomActorView {
  return {
    id: `passage:${passage.id}`,
    name: passage.entrance.name,
    sigil: 'icon:map-landmark',
    identity: '通路',
    responsibility: '',
    appearance: 'facility',
    status: { label: '主线' },
  };
}
