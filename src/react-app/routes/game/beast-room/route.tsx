import { RoomView, type RoomActorView } from '@app/components/feature/room';
import { GameSceneFrame } from '@app/components/game-shell';
import { useNavigate } from 'react-router';

const facilities = [
  {
    id: '/game/beasts',
    sigil: '🐯',
    name: '灵兽袋',
    identity: '灵兽照料',
    responsibility: '查看、培养灵兽并安排出战',
    appearance: 'facility',
  },
  {
    id: '/game/beasts/fusion',
    sigil: '🧬',
    name: '灵兽融合',
    identity: '两灵相合',
    responsibility: '选择两只灵兽，预览融合造化',
    appearance: 'facility',
  },
] satisfies RoomActorView[];

export default function BeastRoomPage() {
  const navigate = useNavigate();
  return (
    <GameSceneFrame variant="workflow">
      <RoomView
        description="室内灵息温润，灵兽袋旁阵纹流转。可在此照料同行灵兽，也可引两灵相合，孕育新的伙伴。"
        actors={facilities}
        onSelect={(href) => navigate(href)}
        prompt="选择一处设施进行交互"
      />
    </GameSceneFrame>
  );
}
